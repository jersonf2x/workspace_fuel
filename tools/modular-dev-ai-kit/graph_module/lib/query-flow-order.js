#!/usr/bin/env node
/**
 * Orden de implementación de un flujo completo (specs en specs-graph).
 *
 * Ordena por aristas depends_on: si A está bloqueada por B, B va antes que A.
 * Las specs de tipo `context` se excluyen (no son ítems de trabajo).
 *
 * Uso:
 *   kg-cli query flow-order
 *   kg-cli query flow-order --json
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

/** Topological sort: edge from → to means "from depends on to" (implement to first). */
function topologicalOrder(graph) {
  const work = graph.nodes.filter(n => n.type !== 'context');
  const ids = work.map(n => n.id);
  const idSet = new Set(ids);
  const inDegree = Object.fromEntries(ids.map(id => [id, 0]));
  const adj = Object.fromEntries(ids.map(id => [id, []]));

  graph.edges
    .filter(e => e.type === 'depends_on')
    .forEach(({ from, to }) => {
      if (!idSet.has(from) || !idSet.has(to)) return;
      adj[to].push(from);
      inDegree[from] += 1;
    });

  const queue = ids.filter(id => inDegree[id] === 0);
  const order = [];

  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (adj[id] || []).forEach(dep => {
      inDegree[dep] -= 1;
      if (inDegree[dep] === 0) queue.push(dep);
    });
  }

  if (order.length !== ids.length) {
    const stuck = ids.filter(id => !order.includes(id));
    console.error('Ciclo o dependencias rotas en depends_on. Revisar front-matter depends_on en:', stuck.join(', '));
    process.exit(1);
  }

  return order.map(id => {
    const node = work.find(n => n.id === id);
    return {
      id,
      file: node?.file,
      title: node?.title,
      type: node?.type,
      status: node?.status,
      repo: node?.repo,
      flows: node?.flows || [],
      blockedBy: node?.dependsOn || [],
    };
  });
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const graph = loadGraph();

  const order = topologicalOrder(graph);

  if (jsonOut) {
    console.log(JSON.stringify({ parent: graph.parent, domain: graph.domain, order }, null, 2));
    return;
  }

  console.log(`Flujo: ${graph.domain || '(sin domain)'} — épico ${graph.parent || '?'}`);
  console.log(`Specs: ${order.length} — orden de implementación:\n`);
  order.forEach((item, i) => {
    const block = item.blockedBy.length ? ` ← bloqueado por ${item.blockedBy.join(', ')}` : '';
    const flows = item.flows.length ? `  {${item.flows.join(', ')}}` : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${item.id}  [${item.status}]  ${item.title || ''}${flows}`);
    console.log(`      ${item.file || ''}${block}`);
  });
  console.log('\nInvocar por spec: @implement <SPEC-ID>');
  console.log('Plan macro: @implement flujo completo — ver specs/README-<flujo>.md');
}

if (require.main === module) main();

module.exports = { topologicalOrder };
