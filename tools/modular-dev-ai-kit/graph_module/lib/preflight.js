#!/usr/bin/env node
/**
 * Preflight — chequeos previos a implementar una spec.
 *
 * Valida en orden:
 *   1. La spec existe en el grafo (kg-cli index specs).
 *   2. Sus depends_on/refines apuntan a specs existentes.
 *   3. Si la spec requiere UI: Figma utilizable (URLs + node-id) — bloqueante.
 *   4. Si requiere UI: configuración MCP Figma disponible.
 *
 * Salida:
 *   - Exit 0 si todo está OK o solo hay warnings.
 *   - Exit 1 si hay errores bloqueantes (spec no existe, Figma faltante en spec UI).
 *
 * Uso:
 *   kg-cli preflight SPEC-FL2-24307
 *   kg-cli preflight FPE-0006 --json
 *   kg-cli preflight --all
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./_config');
const cfg = loadConfig();
const ROOT = cfg.paths.root;
const SPECS_GRAPH = cfg.paths.specsGraph;
const MCP_CONFIG = cfg.paths.mcpConfig;

const { sliceFor } = require('./query-spec-graph');

// ── Spec checks ────────────────────────────────────────────────────────────

function checkSpec(specId) {
  const out = { specId, ok: true, errors: [], warnings: [], info: {} };

  if (!fs.existsSync(SPECS_GRAPH)) {
    out.ok = false;
    out.errors.push(`No existe ${path.relative(ROOT, SPECS_GRAPH)}. Corre: kg-cli index specs`);
    return out;
  }
  const graph = JSON.parse(fs.readFileSync(SPECS_GRAPH, 'utf-8'));
  const target = graph.nodes.find(n => n.id === specId);
  if (!target) {
    out.ok = false;
    out.errors.push(`Spec ${specId} no existe en el grafo.`);
    out.info.availableIds = graph.nodes.map(n => n.id);
    return out;
  }

  const slice = sliceFor(graph, specId);
  out.info.title = target.title;
  out.info.type = target.type;
  out.info.status = target.status;
  out.info.repo = target.repo;
  out.info.repos = target.repos;
  out.info.file = target.file;
  out.info.entities = target.entities;
  out.info.endpoints = target.endpoints;
  out.info.conditions = target.conditions;
  out.info.acceptanceCount = target.acceptanceCount;
  out.info.requiresUi = target.requiresUi;
  out.info.figma = slice.figma;

  if (!target.hasFrontMatter) {
    out.warnings.push('La spec no tiene front-matter YAML — indexada solo por heurística. Añadir front-matter (ver specs/_templates/).');
  }

  const ids = new Set(graph.nodes.map(n => n.id));
  (target.dependsOn || []).forEach(dep => {
    if (!ids.has(dep)) out.warnings.push(`depends_on → ${dep} no existe en el grafo.`);
  });
  (target.refines || []).forEach(ref => {
    if (!ids.has(ref)) out.warnings.push(`refines → ${ref} no existe en el grafo.`);
  });

  if (target.type === 'functional' && !(target.repos || []).length) {
    out.warnings.push('Spec funcional sin repos: declarar repos impactados en el front-matter.');
  }
  if (target.type === 'functional') {
    const techSpecs = graph.edges
      .filter(e => e.type === 'refines' && e.to === specId)
      .map(e => e.from);
    out.info.technicalSpecs = techSpecs;
    if (!techSpecs.length) {
      out.warnings.push('Sin specs técnicas derivadas (refines) aún. Crear una por repo impactado antes de implementar.');
    }
  }
  if (target.acceptanceCount === 0 && target.type !== 'context') {
    out.warnings.push('Spec sin criterios de aceptación (checkboxes). Revisar con el PO/autor.');
  }

  // Figma: bloqueante solo para specs con UI
  if (target.requiresUi) {
    if (slice.figma.status === 'missing') {
      if (slice.figma.fallback) {
        out.warnings.push(`Figma del target ausente — usar fallback de ${slice.figma.fallback.from}.`);
      } else {
        out.ok = false;
        out.errors.push('Figma obligatorio: la spec requiere UI y no tiene URL con node-id. Pedir a diseño antes de implementar.');
      }
    } else if (slice.figma.status === 'incomplete') {
      slice.figma.warnings.forEach(w => out.warnings.push(`Figma incompleto: ${w}`));
    }
  }

  return out;
}

// ── Figma / kit checks (solo specs con UI) ─────────────────────────────────

function checkKitConfig(requiresUi, figma) {
  const out = { mcp: 'figma', ok: true, errors: [], warnings: [], info: {} };

  if (!requiresUi) {
    out.info.hint = 'Spec sin UI — MCP Figma no requerido.';
    return out;
  }

  out.info.figmaStatus = figma?.status || 'unknown';
  out.info.hint = 'Usar MCP Figma: get_screenshot → get_design_context → get_variable_defs';

  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8'));
      const servers = mcpCfg.mcpServers || {};
      const figmaKeys = Object.keys(servers).filter(k => /figma/i.test(k) && !k.startsWith('_'));
      if (figmaKeys.length) out.info.figmaServers = figmaKeys;
      else out.warnings.push('No hay entrada "figma" en mcp.json — OK si usás el plugin Figma de Cursor habilitado en Settings → MCP.');
    } catch (e) {
      out.warnings.push(`mcp.json no parseable: ${e.message}`);
    }
  } else {
    out.warnings.push('Sin .cursor/mcp.json — habilitá MCP Figma en Cursor (plugin oficial).');
  }
  return out;
}

// ── Reporter humano ────────────────────────────────────────────────────────

function colorize(token) {
  // ANSI sencillos para no depender de chalk
  const map = { ok: '\x1b[32m', warn: '\x1b[33m', err: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' };
  const [tone, ...rest] = token.split(':');
  const text = rest.join(':');
  return `${map[tone] || ''}${text}${map.reset}`;
}

function printSpecReport(r) {
  const tag = r.ok ? colorize('ok: ✓') : colorize('err: ✗');
  console.log(`\n${tag} Spec ${r.specId} — ${r.info.title || '?'}`);
  if (r.info.type) {
    console.log(`  ${colorize('dim:tipo:')} ${r.info.type}  ${colorize('dim:status:')} ${r.info.status || '?'}  ${colorize('dim:repo:')} ${r.info.repo || r.info.repos?.join(', ') || '(workspace)'}`);
  }
  if (r.info.requiresUi && r.info.figma) {
    const f = r.info.figma;
    const statusColor = f.status === 'ok' ? 'ok' : (f.status === 'missing' ? 'err' : 'warn');
    console.log(`  ${colorize('dim:Figma:')}  ${colorize(`${statusColor}:${f.status}`)} (${f.targetUrls.length} URL${f.targetUrls.length === 1 ? '' : 's'})`);
    if (f.fallback) {
      console.log(`           ${colorize('dim:fallback →')} ${f.fallback.from} (${f.fallback.title})`);
    }
  }
  r.errors.forEach(e => console.log(`  ${colorize('err:✗')} ${e}`));
  r.warnings.forEach(w => console.log(`  ${colorize('warn:⚠')} ${w}`));
}

function printMcpReport(r) {
  const tag = r.ok ? colorize('ok: ✓') : colorize('err: ✗');
  console.log(`\n${tag} Diseño (${r.mcp})`);
  if (r.info.hint) console.log(`  ${colorize('dim:MCP:')} ${r.info.hint}`);
  if (r.info.figmaServers) console.log(`  ${colorize('dim:servidores:')} ${r.info.figmaServers.join(', ')}`);
  r.errors.forEach(e => console.log(`  ${colorize('err:✗')} ${e}`));
  r.warnings.forEach(w => console.log(`  ${colorize('warn:⚠')} ${w}`));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function runForSpec(specId) {
  const spec = checkSpec(specId);
  const mcp = checkKitConfig(spec.info.requiresUi, spec.info.figma);
  const ok = spec.ok && mcp.ok;
  return { ok, spec, mcp };
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const all = args.includes('--all');
  const specArg = args.find(a => !a.startsWith('--'));

  if (!specArg && !all) {
    console.error('Uso: kg-cli preflight <SPEC-ID|--all> [--json]');
    process.exit(2);
  }

  if (!fs.existsSync(SPECS_GRAPH)) {
    console.error(`No existe ${path.relative(ROOT, SPECS_GRAPH)}. Corre: kg-cli index specs`);
    process.exit(1);
  }
  const graph = JSON.parse(fs.readFileSync(SPECS_GRAPH, 'utf-8'));
  const ids = all
    ? graph.nodes.filter(n => n.type !== 'context').map(n => n.id)
    : [specArg];

  const results = [];
  for (const id of ids) {
    results.push(await runForSpec(id));
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.every(r => r.ok) ? 0 : 1);
    return;
  }

  results.forEach((r, i) => {
    printSpecReport(r.spec);
    if (i === 0) printMcpReport(r.mcp);
  });

  const okCount = results.filter(r => r.ok).length;
  console.log(`\n${colorize('dim:Resumen:')} ${okCount}/${results.length} specs listas para implementar.`);
  process.exit(okCount === results.length ? 0 : 1);
}

if (require.main === module) {
  main().catch(e => {
    console.error('preflight crashed:', e);
    process.exit(99);
  });
}

module.exports = { checkSpec, checkKitConfig };
