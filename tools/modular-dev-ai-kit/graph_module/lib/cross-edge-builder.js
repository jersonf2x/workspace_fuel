#!/usr/bin/env node
/**
 * Cross-Edge Builder — genera edges entre capas MFE y Shell.
 * Input:  { mfe, shell } graphs parciales
 * Output: { edges: CrossEdge[] }
 *
 * Tipos de edge:
 *   shell-embeds-mfe   → Shell webview carga MFE remote
 *   mfe-calls-bff      → MFE datasource llama BFF endpoint
 *   native-capability  → Shell plugin → capability
 *
 * NOTA — La relación MFE ↔ Design System (Pepino) NO se modela en este grafo.
 * El contrato es:
 *   1) Cada spec declara los pp-* que usa en su markdown (spec-indexer.components).
 *   2) En implementación, el MFE consulta MCP Pepino directamente para
 *      attributes/slots/events/tokens. El grafo MFE no necesita conocer el DS.
 */

'use strict';

function edge(type, from, to, meta = {}) {
  return { type, from, to, ...meta };
}

// ── Shell webview → MFE remote ─────────────────────────────────────────────
// Heurística: MFE remote name contiene keywords de la página shell

function buildShellEmbedsMfeEdges(shellGraph, mfeGraph) {
  const edges = [];
  const remoteNames = mfeGraph.remotes.map(r => r.id);

  for (const feature of shellGraph.features || []) {
    for (const page of feature.pages || []) {
      if (!page.isWebView) continue;

      // Intentar match por nombre: "payments_wallet" ← → "payments_wallet_microfrontend"
      const pageLower = page.name.toLowerCase();
      let matchedRemote = remoteNames.find(r => {
        const keywords = r.replace('_microfrontend', '').split('_');
        return keywords.some(kw => kw.length > 3 && pageLower.includes(kw));
      });

      // Fallback: si la página es genérica "MicroProductsPage" → remote desconocido en runtime
      if (!matchedRemote && page.name.includes('MicroProducts')) {
        matchedRemote = 'runtime-resolved'; // el shell resuelve el remote en runtime
      }

      if (matchedRemote) {
        edges.push(edge('shell-embeds-mfe',
          `${feature.id}::${page.name}`,
          matchedRemote,
          { shellRoute: feature.routes[0]?.path || null }
        ));
      }
    }
  }
  return edges;
}

// ── MFE datasource → BFF endpoint ─────────────────────────────────────────

function buildMfeBffEdges(mfeGraph) {
  const edges = [];
  for (const remote of mfeGraph.remotes || []) {
    for (const ds of remote.datasources || []) {
      for (const endpoint of ds.endpoints || []) {
        edges.push(edge('mfe-calls-bff',
          `${remote.id}::${ds.className}`,
          endpoint,
          { remote: remote.id }
        ));
      }
    }
  }
  return edges;
}

// ── Native capability → Shell (nunca MFE) ─────────────────────────────────

function buildNativeCapabilityEdges(shellGraph) {
  return (shellGraph.nativeCapabilities || []).map(cap =>
    edge('native-capability',
      `shell::plugin::${cap.plugin}`,
      `shell::capability::${cap.capability}`,
      { description: cap.description, note: cap.note }
    )
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

function buildCrossEdges(mfe, shell) {
  const allEdges = [
    ...buildShellEmbedsMfeEdges(shell, mfe),
    ...buildMfeBffEdges(mfe),
    ...buildNativeCapabilityEdges(shell)
  ];

  const byType = allEdges.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  console.error('[cross-edge-builder] edges by type:', JSON.stringify(byType));
  return { edges: allEdges };
}

module.exports = { buildCrossEdges };

if (require.main === module) {
  const [,, mfePath, shellPath] = process.argv;
  if (mfePath && shellPath) {
    const mfe = JSON.parse(require('fs').readFileSync(mfePath));
    const shell = JSON.parse(require('fs').readFileSync(shellPath));
    console.log(JSON.stringify(buildCrossEdges(mfe, shell), null, 2));
  } else {
    console.error('Usage: node cross-edge-builder.js mfe.json shell.json');
  }
}
