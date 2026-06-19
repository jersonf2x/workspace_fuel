#!/usr/bin/env node
/**
 * generate implement-prompt <SPEC-ID>
 *
 * Genera el prompt @implement con campos pre-rellenados desde el slice 1-hop de la spec.
 * Output: stdout (markdown listo para pegar al chat IA).
 *
 * Uso:
 *   kg-cli generate implement-prompt SPEC-FL2-24307
 *   kg-cli generate implement-prompt FPE-0006 --json     (para tooling)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./_config');

function main() {
  const args = process.argv.slice(2);
  const specId = args.find(a => !a.startsWith('--'));
  const asJson = args.includes('--json');

  if (!specId) {
    console.error('Uso: kg-cli generate implement-prompt <SPEC-ID> [--json]');
    process.exit(2);
  }

  const cfg = loadConfig();
  const graphFile = cfg.paths.specsGraph;
  const specsDir = cfg.paths.specsDir;

  if (!fs.existsSync(graphFile)) {
    console.error(`No existe ${graphFile}. Corre primero: kg-cli index specs`);
    process.exit(1);
  }

  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
  const node = graph.nodes.find(n => n.id === specId);
  if (!node) {
    console.error(`Spec ${specId} no existe en el grafo. Corre: kg-cli index specs`);
    process.exit(1);
  }

  // Detectar flujo desde README-<flujo>.md en specsDir
  let flujoName = 'desconocido';
  if (fs.existsSync(specsDir)) {
    const readmes = fs.readdirSync(specsDir)
      .filter(f => /^README-.+\.md$/.test(f) && !f.endsWith('.template.md'));
    if (readmes.length > 0) {
      flujoName = readmes[0].replace(/^README-/, '').replace(/\.md$/, '');
    }
  }

  // Contratos API del grafo
  const contracts = (graph.contracts || []).join(', ') || 'ninguno';

  // Orden y total (solo specs de trabajo)
  const work = graph.nodes.filter(n => n.type !== 'context');
  const total = work.length;
  const dependsMap = new Map(work.map(n => [n.id, new Set()]));
  graph.edges
    .filter(e => e.type === 'depends_on')
    .forEach(e => dependsMap.get(e.from)?.add(e.to));
  const order = [];
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    (dependsMap.get(id) || []).forEach(visit);
    order.push(id);
  }
  work.forEach(n => visit(n.id));
  const pos = order.indexOf(specId) + 1;

  // Slice 1-hop
  const dependsOn = graph.edges
    .filter(e => e.type === 'depends_on' && e.from === specId)
    .map(e => e.to);
  const techSpecs = graph.edges
    .filter(e => e.type === 'refines' && e.to === specId)
    .map(e => {
      const t = graph.nodes.find(n => n.id === e.from);
      return t ? `${t.id} (${t.file})` : e.from;
    });
  const refines = graph.edges
    .filter(e => e.type === 'refines' && e.from === specId)
    .map(e => e.to);
  const sharesEntity = graph.edges
    .filter(e => e.type === 'shares_entity' && (e.from === specId || e.to === specId))
    .map(e => e.from === specId ? e.to : e.from);
  const sharesEndpoint = graph.edges
    .filter(e => e.type === 'shares_endpoint' && (e.from === specId || e.to === specId))
    .map(e => e.from === specId ? e.to : e.from);

  // Figma URL
  let figmaUrl = 'N/A — sin UI';
  if (Array.isArray(node.figmaUrls) && node.figmaUrls.length > 0) {
    figmaUrl = node.figmaUrls.map(f => f.url).join('\n                 ');
  }

  const repos = (node.repos && node.repos.length ? node.repos : node.repo ? [node.repo] : [])
    .join(', ') || 'definir según contenido de la spec';

  // Flujos de negocio a los que pertenece la spec (definidos en la spec de contexto)
  const nodeFlows = node.flows || [];
  const flowDefs = (graph.flows || []).filter(f => nodeFlows.includes(f.key));
  const businessFlows = flowDefs.length
    ? flowDefs.map(f => `${f.name || f.key} (${f.key})`).join('; ')
    : nodeFlows.join(', ') || 'transversal — no pertenece a un flujo específico';

  const data = {
    SPEC_ID: specId,
    SPEC_FILE: node.file,
    SPEC_TYPE: node.type,
    FLUJO_NAME: flujoName,
    BUSINESS_FLOWS: businessFlows,
    SPEC_POS: pos,
    SPEC_TOTAL: total,
    CONTRACT_FILES: contracts,
    FIGMA_URL: figmaUrl,
    REPOS: repos,
    TECH_SPECS: techSpecs.join(', ') || (node.type === 'functional' ? 'ninguna aún — crear antes de implementar' : 'n/a'),
    REFINES: refines.join(', ') || 'ninguna',
    DEPENDS_ON: dependsOn.length ? dependsOn.join(', ') : 'ninguno',
    SHARES_ENTITY: [...new Set(sharesEntity)].join(', ') || 'ninguno',
    SHARES_ENDPOINT: [...new Set(sharesEndpoint)].join(', ') || 'ninguno',
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  const prompt = `@implement ${data.SPEC_ID}

Spec (${data.SPEC_TYPE}): ${data.SPEC_FILE}
Flujo:           ${data.FLUJO_NAME} — spec ${data.SPEC_POS} de ${data.SPEC_TOTAL} según specs/README-${data.FLUJO_NAME}.md
Flujo(s) negocio: ${data.BUSINESS_FLOWS} — detalle: kg-cli query flows
Specs técnicas:  ${data.TECH_SPECS}
Refina:          ${data.REFINES}
Contratos:       ${data.CONTRACT_FILES}
Figma:           ${data.FIGMA_URL}
Repos:           ${data.REPOS}

Bloqueado por:           ${data.DEPENDS_ON}
Comparte entidades con:  ${data.SHARES_ENTITY}
Comparte endpoint con:   ${data.SHARES_ENDPOINT}

Reglas:
- Solo esta spec. Respetar lo ya mergeado.
- Leer primero specs/0000_SPEC_project_context.md del repo tocado y luego la spec técnica.
- UI web: convenciones del repo frontend + tokens desde MCP Figma (node-id obligatorio).
- Plan → "aprobado" (G1) → código → arnés (auto) → prereview → G2 → push.
- Todo cambio sustantivo actualiza la spec correspondiente y reindexa (kg-cli index specs).
- No marcar done sin prereview verde.
`;

  process.stdout.write(prompt);
}

if (require.main === module) {
  main();
}

module.exports = { main };
