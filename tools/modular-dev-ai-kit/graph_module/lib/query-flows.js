#!/usr/bin/env node
/**
 * Flujos de negocio del dominio (sección `flows` del specs-graph).
 *
 * Responde desde el grafo: ¿cuáles son los flujos del dominio?, ¿qué specs
 * pertenecen a cada flujo?, ¿qué entidades/relaciones los gobiernan?
 * Las definiciones provienen del front-matter `flow_definitions` de la spec
 * de contexto del workspace; las specs de trabajo se etiquetan con `flows:`.
 *
 * Uso:
 *   kg-cli query flows
 *   kg-cli query flows --json
 *   kg-cli query flows <flow-key>     # detalle de un solo flujo
 */

'use strict';

const fs = require('fs');

const { loadConfig } = require('./_config');
const cfg = loadConfig();
const GRAPH_FILE = cfg.paths.specsGraph;

function loadGraph() {
  if (!fs.existsSync(GRAPH_FILE)) {
    console.error(`No existe ${GRAPH_FILE}. Corre: kg-cli index specs`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf-8'));
}

function nodeById(graph, id) {
  return graph.nodes.find(n => n.id === id);
}

function printFlow(graph, flow, idx) {
  console.log(`${idx != null ? `${idx}. ` : ''}${flow.name || flow.key}  (${flow.key})`);
  if (flow.summary) console.log(`   ${flow.summary}`);
  if (flow.states) console.log(`   Estados: ${flow.states}`);
  if (Array.isArray(flow.entities) && flow.entities.length) {
    console.log(`   Entidades: ${flow.entities.join(', ')}`);
  }
  if (flow.notes) console.log(`   Nota: ${flow.notes}`);
  if (flow.specs.length) {
    console.log(`   Specs (${flow.specs.length}):`);
    flow.specs.forEach(id => {
      const n = nodeById(graph, id);
      console.log(`     - ${id}  [${n?.repo || 'workspace'}]  ${n?.title || ''}`);
    });
  } else {
    console.log('   Specs: (ninguna etiquetada aún)');
  }
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const flowKey = args.find(a => !a.startsWith('--')) || null;

  const graph = loadGraph();
  const flows = graph.flows || [];

  if (!flows.length) {
    console.error('El grafo no tiene flujos definidos. Define flow_definitions en la spec de contexto del workspace y corre: kg-cli index specs');
    process.exit(1);
  }

  const selected = flowKey ? flows.filter(f => f.key === flowKey) : flows;
  if (flowKey && !selected.length) {
    console.error(`Flujo '${flowKey}' no existe. Disponibles: ${flows.map(f => f.key).join(', ')}`);
    process.exit(2);
  }

  if (jsonOut) {
    console.log(JSON.stringify({ domain: graph.domain, flows: selected }, null, 2));
    return;
  }

  if (!flowKey) {
    console.log(`Flujos del dominio ${graph.domain || '(sin domain)'}: ${flows.length}`);
    const ctx = flows[0] && nodeById(graph, flows[0].definedIn);
    if (ctx) console.log(`Definidos en: ${ctx.id} (${ctx.file})`);
    console.log('');
  }

  selected.forEach((flow, i) => printFlow(graph, flow, flowKey ? null : i + 1));

  const noFlow = (graph.summary && graph.summary.specsWithoutFlow) || [];
  if (!flowKey && noFlow.length) {
    console.log(`Specs transversales / sin flujo: ${noFlow.join(', ')}`);
  }
}

if (require.main === module) main();
