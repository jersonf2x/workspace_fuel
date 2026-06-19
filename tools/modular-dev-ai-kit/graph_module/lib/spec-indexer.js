#!/usr/bin/env node
/**
 * Spec Indexer — parsea specs markdown (padre + repos hijos) → grafo semántico de specs.
 *
 * Fuente primaria: front-matter YAML de cada spec (id, type, status, repo/repos,
 * refines, depends_on, entities, endpoints, components, conditions, figma).
 * Fallback heurístico: H1 como título, vocabulario de dominio configurable
 * (graphify.config.json → domainVocabulary) escaneado sobre el cuerpo.
 *
 * Niveles:
 *   - functional → specs/SPEC-*.md del workspace padre (qué + criterios)
 *   - technical  → <repo>/specs/000X_SPEC_*.md (cómo, por repo; refines → functional)
 *   - context    → <repo>/specs/0000_SPEC_project_context.md (no entra al flow-order)
 *
 * Aristas: depends_on, refines, shares_component, shares_entity, shares_endpoint.
 *
 * Output: graph/specs-graph.json
 *
 * Uso:  kg-cli index specs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { loadConfig, resolveFlowMeta } = require('./_config');
const cfg = loadConfig();
const ROOT = cfg.paths.root;
const SPECS_DIR = cfg.paths.specsDir;
const REPO_SPECS_DIRS = cfg.paths.repoSpecsDirs;
const OUT_FILE = cfg.paths.specsGraph;
const VOCAB = cfg.domainVocabulary || { entities: [], conditions: [] };
const FRONTEND_REPOS = (cfg.specs && cfg.specs.frontendRepos) || [];

// ── helpers ────────────────────────────────────────────────────────────────

function read(p) {
  return fs.readFileSync(p, 'utf-8');
}

function unique(arr) {
  return Array.from(new Set(arr));
}

// ── front-matter parser (subconjunto YAML, sin dependencias) ──────────────
// Soporta: escalares, null, listas inline [a, b], listas en bloque de
// escalares y listas en bloque de objetos planos (ej. figma: - url / mode).

function stripComment(line) {
  return line.replace(/\s+#.*$/, '');
}

function parseScalar(raw) {
  const v = String(raw).trim().replace(/^["']|["']$/g, '');
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    const inner = v.replace(/^\[|\]$/g, '').trim();
    if (!inner) return [];
    return inner.split(',').map(parseScalar).filter(x => x !== null);
  }
  return parseScalar(v);
}

function parseFrontMatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, body: content };
  const body = content.slice(m[0].length);
  const data = {};
  let currentList = null;
  let currentObj = null;

  for (const raw of m[1].split('\n')) {
    const line = stripComment(raw.replace(/\r$/, ''));
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();

    if (indent === 0) {
      currentObj = null;
      const kv = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, key, val] = kv;
      if (val === '') {
        data[key] = [];
        currentList = data[key];
      } else {
        data[key] = parseValue(val);
        currentList = null;
      }
    } else if (trimmed.startsWith('- ')) {
      if (!currentList) continue;
      const item = trimmed.slice(2).trim();
      const kv = item.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (kv) {
        currentObj = { [kv[1]]: parseValue(kv[2]) };
        currentList.push(currentObj);
      } else {
        currentObj = null;
        const parsed = parseScalar(item);
        if (parsed !== null) currentList.push(parsed);
      }
    } else if (currentObj) {
      const kv = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (kv) currentObj[kv[1]] = parseValue(kv[2]);
    }
  }
  return { data, body };
}

// ── extractores de contenido (fallback/merge) ──────────────────────────────

function extractTitle(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function camelToSnake(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function scanEntities(body) {
  return (VOCAB.entities || []).filter(e => {
    const variants = unique([e, camelToSnake(e)]).map(v =>
      v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    return new RegExp(`\\b(${variants.join('|')})\\b`, 'i').test(body);
  });
}

function scanConditions(body) {
  return (VOCAB.conditions || [])
    .filter(c => {
      try {
        return new RegExp(c.pattern, 'i').test(body);
      } catch (_) {
        return false;
      }
    })
    .map(c => c.key);
}

function scanEndpoints(body) {
  const matches = [...body.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9_\-:.{}/]+)/g)]
    .map(m => `${m[1]} ${m[2]}`);
  return unique(matches);
}

function scanComponents(body) {
  return unique([...body.matchAll(/\bpp-[a-z]+(?:-[a-z]+)*\b/g)].map(m => m[0])).sort();
}

function scanFigmaUrls(body) {
  return unique([...body.matchAll(/https:\/\/www\.figma\.com\/design\/[^\s)"'`]+/g)].map(m => m[0]));
}

function toFigmaEntry(url, mode) {
  const node = String(url).match(/node-id=([\d-]+)/);
  return { url, nodeId: node ? node[1] : null, mode: mode || 'unknown' };
}

function countAcceptance(body) {
  return [...body.matchAll(/^\s*-\s*\[[ xX]?\]\s*.+$/gm)].length;
}

// figmaStatus:
//   'n/a'        → la spec no requiere UI.
//   'ok'         → URLs con nodeId; si requiere dark mode, cubre ambos modos.
//   'incomplete' → hay URLs pero falta nodeId o falta modo dark requerido.
//   'missing'    → requiere UI y no hay URL Figma.
function computeFigmaStatus(figmaUrls, conditions, requiresUi) {
  const warnings = [];
  if (!requiresUi) return { status: 'n/a', warnings };
  if (!figmaUrls.length) {
    warnings.push('Spec con UI sin Figma URL. Pedir node-id a diseño antes de implementar (bloqueante UI).');
    return { status: 'missing', warnings };
  }
  const withoutNode = figmaUrls.filter(f => !f.nodeId);
  if (withoutNode.length) {
    warnings.push(`${withoutNode.length}/${figmaUrls.length} URL(s) Figma sin node-id (no se podrá usar MCP Figma get_design_context).`);
  }
  const modes = new Set(figmaUrls.map(f => f.mode));
  const needsDark = conditions.includes('dark_mode');
  if (needsDark && !modes.has('dark')) {
    warnings.push('La spec requiere dark mode pero no hay URL Figma en modo dark.');
  }
  if (needsDark && !modes.has('light')) {
    warnings.push('La spec requiere dark mode y debería incluir también el modo light para comparación.');
  }
  return { status: warnings.length ? 'incomplete' : 'ok', warnings };
}

// ── parser de una spec ─────────────────────────────────────────────────────

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseSpec(absFile, repoName) {
  const content = read(absFile);
  const { data, body } = parseFrontMatter(content);
  const fm = data || {};
  const relFile = path.relative(ROOT, absFile);
  const base = path.basename(absFile, '.md');

  const id = fm.id || base;
  const type = fm.type || (/^0000_/.test(base) ? 'context' : repoName ? 'technical' : 'functional');
  const repo = fm.repo || repoName || null;
  const repos = asArray(fm.repos).length ? asArray(fm.repos) : repo ? [repo] : [];

  const entities = unique([...asArray(fm.entities), ...scanEntities(body)]);
  const conditions = unique([...asArray(fm.conditions), ...scanConditions(body)]);
  const endpoints = unique([...asArray(fm.endpoints), ...scanEndpoints(body)]);
  const components = unique([...asArray(fm.components), ...scanComponents(body)]);

  const fmFigma = asArray(fm.figma)
    .map(f => (typeof f === 'string' ? toFigmaEntry(f) : f && f.url ? toFigmaEntry(f.url, f.mode) : null))
    .filter(Boolean);
  const bodyFigma = scanFigmaUrls(body)
    .filter(url => !fmFigma.some(f => f.url === url))
    .map(url => toFigmaEntry(url));
  const figmaUrls = [...fmFigma, ...bodyFigma];

  const requiresUi =
    FRONTEND_REPOS.includes(repo) ||
    repos.some(r => FRONTEND_REPOS.includes(r)) ||
    figmaUrls.length > 0 ||
    components.length > 0;

  const { status: figmaStatus, warnings: figmaWarnings } = computeFigmaStatus(figmaUrls, conditions, requiresUi);

  return {
    id,
    file: relFile,
    title: fm.title || extractTitle(body) || base,
    type,
    status: fm.status || 'draft',
    jira: fm.jira || null,
    repo,
    repos,
    refines: asArray(fm.refines),
    dependsOn: asArray(fm.depends_on),
    flows: asArray(fm.flows),
    flowDefinitions: asArray(fm.flow_definitions).filter(d => d && typeof d === 'object' && d.key),
    entities,
    endpoints,
    components,
    conditions,
    figmaUrls,
    figmaStatus,
    figmaWarnings,
    requiresUi,
    acceptanceCount: countAcceptance(body),
    hasFrontMatter: data !== null,
  };
}

// ── discovery de archivos ──────────────────────────────────────────────────

function listSpecFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_') && !/^README/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

function repoNameFromDir(absDir) {
  // <ROOT>/<repo>/specs → <repo>; specsDir del padre → null
  const rel = path.relative(ROOT, absDir);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : null;
}

// ── aristas ────────────────────────────────────────────────────────────────

function buildEdges(nodes) {
  const edges = [];
  const warnings = [];
  const ids = new Set(nodes.map(n => n.id));

  nodes.forEach(n => {
    n.dependsOn.forEach(target => {
      if (!ids.has(target)) {
        warnings.push(`${n.id}: depends_on → ${target} no existe en el grafo.`);
      }
      edges.push({ from: n.id, to: target, type: 'depends_on' });
    });
    n.refines.forEach(target => {
      if (!ids.has(target)) {
        warnings.push(`${n.id}: refines → ${target} no existe en el grafo.`);
      }
      edges.push({ from: n.id, to: target, type: 'refines' });
    });
  });

  // shares_X par a par — solo entre specs de trabajo (excluye context)
  const work = nodes.filter(n => n.type !== 'context');
  for (let i = 0; i < work.length; i++) {
    for (let j = i + 1; j < work.length; j++) {
      const a = work[i];
      const b = work[j];
      const sharedComponents = a.components.filter(c => b.components.includes(c));
      if (sharedComponents.length) {
        edges.push({ from: a.id, to: b.id, type: 'shares_component', attrs: { components: sharedComponents } });
      }
      const sharedEntities = a.entities.filter(e => b.entities.includes(e));
      if (sharedEntities.length) {
        edges.push({ from: a.id, to: b.id, type: 'shares_entity', attrs: { entities: sharedEntities } });
      }
      const sharedEndpoints = a.endpoints.filter(e => b.endpoints.includes(e));
      if (sharedEndpoints.length) {
        edges.push({ from: a.id, to: b.id, type: 'shares_endpoint', attrs: { endpoints: sharedEndpoints } });
      }
    }
  }

  return { edges, warnings };
}

// ── flujos de negocio ──────────────────────────────────────────────────────
// Las definiciones viven en el front-matter (flow_definitions) de la spec de
// contexto del workspace; cada spec de trabajo se etiqueta con flows: [key].

function buildFlows(nodes, warnings) {
  const flows = [];
  const seen = new Set();

  nodes.forEach(n => {
    n.flowDefinitions.forEach(def => {
      if (seen.has(def.key)) {
        warnings.push(`Flujo '${def.key}' definido más de una vez (segunda definición en ${n.id} ignorada).`);
        return;
      }
      seen.add(def.key);
      flows.push({ ...def, definedIn: n.id, specs: [] });
    });
  });

  nodes.forEach(n => {
    n.flows.forEach(key => {
      const flow = flows.find(f => f.key === key);
      if (!flow) {
        warnings.push(`${n.id}: flows → '${key}' no está definido en ninguna spec de contexto (flow_definitions).`);
        return;
      }
      flow.specs.push(n.id);
    });
  });

  return flows;
}

// ── main ───────────────────────────────────────────────────────────────────

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const k = fn(item) || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function main() {
  const dirs = [SPECS_DIR, ...REPO_SPECS_DIRS];
  const files = dirs.flatMap(d =>
    listSpecFiles(d).map(f => ({ file: f, repo: repoNameFromDir(d) }))
  );

  if (!files.length) {
    console.error(`No hay specs en ${path.relative(ROOT, SPECS_DIR)} ni en specs.repoDirs.`);
    process.exit(1);
  }

  const nodes = files.map(({ file, repo }) => parseSpec(file, repo));

  // ids duplicados
  const dupes = Object.entries(countBy(nodes, n => n.id)).filter(([, c]) => c > 1);
  dupes.forEach(([id]) => console.warn(`⚠ id duplicado en el grafo: ${id}`));

  const { edges, warnings } = buildEdges(nodes);
  const flows = buildFlows(nodes, warnings);

  // contratos API del padre
  const contracts = fs.existsSync(SPECS_DIR)
    ? fs.readdirSync(SPECS_DIR)
        .filter(f => /^_api-.+\.md$/.test(f))
        .map(f => path.join(path.relative(ROOT, SPECS_DIR), f))
    : [];

  const flowMeta = resolveFlowMeta(cfg);

  const graph = {
    version: '2.0',
    builtAt: new Date().toISOString(),
    workspace: cfg.workspaceName,
    domain: flowMeta.domain,
    parent: flowMeta.parent,
    flowReadme: flowMeta.readme,
    summary: {
      specs: nodes.length,
      byType: countBy(nodes, n => n.type),
      byRepo: countBy(nodes, n => n.repo || '(workspace)'),
      byStatus: countBy(nodes, n => n.status),
      flows: flows.map(f => ({ key: f.key, specs: f.specs.length })),
      specsWithoutFlow: nodes
        .filter(n => n.type !== 'context' && !n.flows.length)
        .map(n => n.id),
      edges: edges.length,
      byEdgeType: countBy(edges, e => e.type),
      figmaStatus: countBy(nodes, n => n.figmaStatus),
      specsWithFigmaIssues: nodes
        .filter(n => n.figmaStatus !== 'ok' && n.figmaStatus !== 'n/a')
        .map(n => n.id),
      withoutFrontMatter: nodes.filter(n => !n.hasFrontMatter).map(n => n.id),
      warnings,
      files: nodes.map(n => n.file),
    },
    contracts,
    flows,
    nodes,
    edges,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(graph, null, 2), 'utf-8');

  console.log(`✓ Grafo de specs escrito en ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`  Specs:   ${nodes.length}`);
  Object.entries(graph.summary.byType).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  console.log(`  Flujos:  ${flows.length}`);
  flows.forEach(f => console.log(`    ${f.key}: ${f.specs.length} spec(s)`));
  console.log(`  Aristas: ${edges.length}`);
  Object.entries(graph.summary.byEdgeType).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  if (warnings.length) {
    console.log(`  ⚠ Warnings:`);
    warnings.forEach(w => console.log(`    - ${w}`));
  }
  if (graph.summary.withoutFrontMatter.length) {
    console.log(`  ⚠ Sin front-matter (heurística aplicada): ${graph.summary.withoutFrontMatter.join(', ')}`);
  }
}

if (require.main === module) main();

module.exports = { parseSpec, parseFrontMatter, buildEdges };
