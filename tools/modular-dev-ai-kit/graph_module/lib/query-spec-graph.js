#!/usr/bin/env node
/**
 * Slicer del grafo de specs — produce el "contexto mínimo" para una spec.
 *
 * Caso de uso: cuando se pide "implementa SPEC-FL2-24307", solo manda
 *   nodo target + nodos 1-hop (depends_on, refines, shares_*) + contratos.
 * En vez de pegar todas las specs crudas.
 *
 * Uso:
 *   kg-cli query spec-slice SPEC-FL2-24307
 *   kg-cli query spec-slice FPE-0006 --tokens     (solo conteo)
 *   kg-cli query spec-slice FPE-0006 --raw-cmp    (comparar vs specs crudas)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./_config');
const cfg = loadConfig();
const ROOT = cfg.paths.root;
const GRAPH_FILE = cfg.paths.specsGraph;

function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

function loadGraph() {
  if (!fs.existsSync(GRAPH_FILE)) {
    console.error(`No existe ${GRAPH_FILE}. Corre: kg-cli index specs`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf-8'));
}

function sliceFor(graph, specId) {
  const target = graph.nodes.find(n => n.id === specId);
  if (!target) {
    console.error(`Spec ${specId} no existe en el grafo. IDs: ${graph.nodes.map(n => n.id).join(', ')}`);
    process.exit(1);
  }

  const relatedEdges = graph.edges.filter(e => e.from === specId || e.to === specId);
  const neighborIds = new Set();
  relatedEdges.forEach(e => {
    neighborIds.add(e.from === specId ? e.to : e.from);
  });

  const neighbors = graph.nodes
    .filter(n => neighborIds.has(n.id))
    // versión slim para contexto del agente
    .map(n => ({
      id: n.id,
      title: n.title,
      type: n.type,
      status: n.status,
      repo: n.repo,
      file: n.file,
      dependsOn: n.dependsOn,
      entities: n.entities,
      endpoints: n.endpoints,
      components: n.components,
      conditions: n.conditions,
      figmaStatus: n.figmaStatus,
      figmaUrls: n.figmaUrls,
    }));

  // definiciones de los flujos a los que pertenece la spec (contexto de negocio)
  const flows = (graph.flows || []).filter(f => (target.flows || []).includes(f.key));

  return {
    queryFor: specId,
    domain: graph.domain,
    contracts: graph.contracts || [],
    target,
    flows,
    relatedEdges,
    neighbors,
    figma: buildFigmaSection(target, neighbors, relatedEdges),
  };
}

// Resumen de la situación Figma de la spec + fallback de neighbors.
// Solo aplica a specs con UI (figmaStatus !== 'n/a').
function buildFigmaSection(target, neighbors, relatedEdges) {
  const result = {
    status: target.figmaStatus,
    targetUrls: target.figmaUrls,
    warnings: [...(target.figmaWarnings || [])],
    fallback: null,
  };

  if (target.figmaStatus === 'ok' || target.figmaStatus === 'n/a') return result;

  // buscar fallback entre neighbors conectados por shares_component
  const sharesComponent = relatedEdges
    .filter(e => e.type === 'shares_component')
    .map(e => (e.from === target.id ? e.to : e.from));

  const candidate = neighbors.find(n =>
    sharesComponent.includes(n.id) &&
    n.figmaStatus === 'ok' &&
    (n.figmaUrls || []).length > 0
  );

  if (candidate) {
    result.fallback = {
      from: candidate.id,
      title: candidate.title,
      urls: candidate.figmaUrls,
      reason: `Comparte componentes con ${target.id} (shares_component). Usar como referencia visual hasta que ${target.id} tenga su propio Figma.`,
    };
    result.warnings.push(`Fallback disponible: revisar Figma de ${candidate.id} (${candidate.title}).`);
  } else {
    result.warnings.push('No hay fallback automático entre neighbors (ninguno con figmaStatus=ok que comparta componentes). Pedir el Figma al autor de la spec antes de implementar.');
  }
  return result;
}

function main() {
  const specId = process.argv[2];
  const flag = process.argv[3];

  if (!specId) {
    console.error('Uso: kg-cli query spec-slice <SPEC-ID> [--tokens|--raw-cmp]');
    process.exit(1);
  }

  const graph = loadGraph();
  const slice = sliceFor(graph, specId);
  const sliceJson = JSON.stringify(slice, null, 2);
  const tokens = approxTokens(sliceJson);

  if (flag === '--raw-cmp') {
    // comparar slice vs mandar todas las specs crudas
    const allRaw = (graph.summary.files || [])
      .map(f => {
        const abs = path.join(ROOT, f);
        return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8') : '';
      })
      .join('\n\n---\n\n');
    const rawTokens = approxTokens(allRaw);
    const saved = rawTokens - tokens;
    const pct = rawTokens ? ((saved / rawTokens) * 100).toFixed(2) : '0';

    console.log(`\n📌 Query: "implementa ${specId}"\n`);
    console.log(`  Sin grafo (todas las specs):  ${rawTokens.toLocaleString('es-CO')} tokens`);
    console.log(`  Con grafo (slice 1-hop):      ${tokens.toLocaleString('es-CO')} tokens`);
    console.log(`  Ahorro:                       ${pct}%\n`);
    return;
  }

  if (flag === '--tokens') {
    console.log(`${specId}: ${tokens} tokens (slice 1-hop)`);
    return;
  }

  console.log(sliceJson);
  console.error(`\n— ${tokens} tokens aprox —`);
}

if (require.main === module) main();

module.exports = { sliceFor };
