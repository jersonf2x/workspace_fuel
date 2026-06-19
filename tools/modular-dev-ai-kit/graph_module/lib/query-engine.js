#!/usr/bin/env node
/**
 * Query Engine — dado un intent de feature, devuelve subgrafo compacto.
 * Uso: node query-engine.js "pantalla movimientos con paginacion"
 *
 * Output: JSON compacto (~300-800 tokens) con contexto relevante para el graph-agent.
 *
 * NOTA — El Design System (Pepino) NO se consulta desde el grafo.
 * Para specs de pp-* usar MCP Pepino directamente; los componentes a usar
 * vienen declarados en cada spec (spec-indexer.components).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const GRAPH_PATH = path.join(__dirname, '../graph/flypass-graph.json');
const MCP_CONFIG = path.join(__dirname, '..', '.cursor', 'mcp.json');

// ── Spanish → English domain aliases ────────────────────────────────────

const ES_EN = {
  // remotes
  'billetera': 'wallet', 'pagos': 'payments', 'movimientos': 'wallet',
  'servicios': 'payments', 'recargas': 'wallet', 'cobros': 'wallet',
  'cliente': 'customer', 'cuenta': 'account', 'vehiculos': 'vehicle',
  'vehiculo': 'vehicle', 'inicio': 'home', 'seguridad': 'security',
  'autenticacion': 'authentication', 'recuperacion': 'password',
  // features
  'pantalla': 'page', 'lista': 'list', 'tarjeta': 'card', 'tarjetas': 'card',
  'paginacion': 'pagination', 'detalle': 'detail',
  'errores': 'error', 'error': 'error', 'pestaña': 'tab', 'pestanas': 'tab',
  // shell navigation
  'navegacion': 'navigation', 'sesion': 'session', 'nativo': 'native',
  // native capabilities → siempre Shell Flutter
  'camara': 'camera', 'camará': 'camera', 'foto': 'camera', 'fotos': 'camera',
  'internet': 'connectivity', 'conectividad': 'connectivity', 'conexion': 'connectivity',
  'sin-internet': 'connectivity', 'offline': 'connectivity', 'red': 'connectivity',
  'biometria': 'biometrics', 'biometría': 'biometrics', 'huella': 'biometrics',
  'faceid': 'biometrics', 'face-id': 'biometrics', 'dactilar': 'biometrics',
  'permisos': 'permissions', 'permiso': 'permissions',
  'ubicacion': 'gps', 'ubicación': 'gps', 'localizacion': 'gps', 'mapa': 'gps',
  'notificacion': 'notifications', 'notificaciones': 'notifications', 'push': 'push_notifications',
  'nfc': 'nfc', 'bluetooth': 'bluetooth',
  'compartir': 'share', 'almacenamiento': 'secure_storage',
  // shell UIKit
  'boton': 'button', 'botón': 'button', 'texto': 'text', 'icono': 'icon',
  'menu': 'menu', 'navegador': 'navigation',
};

// ── Helpers de scoring ────────────────────────────────────────────────────

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[_-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function expandKeywords(keywords) {
  const expanded = new Set(keywords);
  for (const kw of keywords) {
    if (ES_EN[kw]) expanded.add(ES_EN[kw]);
  }
  return [...expanded];
}

function score(text, keywords) {
  const words = tokenize(text);
  return keywords.reduce((s, kw) =>
    s + (words.some(w => w.includes(kw) || kw.includes(w)) ? 1 : 0), 0);
}

// ── Query MFE: remote + capas existentes ─────────────────────────────────

function queryMFE(graph, keywords, targetRemote) {
  const remotes = graph.mfe.remotes.filter(r => {
    if (targetRemote) return r.id.includes(targetRemote);
    return score(r.id, keywords) > 0 || r.id.includes('host');
  });

  return remotes.map(r => ({
    id: r.id,
    dir: r.dir,
    exposes: r.exposes,
    entities: r.domain.entities.map(e => ({
      name: e.name,
      fields: e.fields?.slice(0, 5).map(f => `${f.name}:${f.type}`)
    })),
    useCases: r.domain.useCases.map(u => ({ name: u.name, file: u.file })),
    facades: r.presentation.facades.map(f => ({ name: f.name, stateModel: f.stateModel })),
    services: r.presentation.services.map(s => s.name),
    datasources: r.datasources.map(d => ({
      name: d.className,
      endpoints: d.endpoints
    })),
    routes: r.routes.slice(0, 8)
  }));
}

// ── Query Shell: features + bridge events relevantes ─────────────────────

function queryShell(graph, keywords) {
  const relevant = graph.shell.features.filter(f =>
    score(f.id, keywords) > 0 || f.id === 'micro_products'
  );

  const bridgeEvents = graph.shell.bridgeEvents.filter(e =>
    keywords.some(kw => e.name.includes(kw)) || e.name.includes('session') || e.name.includes('navigation')
  );

  // Capacidades nativas que coinciden con keywords → feature Shell puro
  const nativeCaps = (graph.shell.nativeCapabilities || []).filter(cap =>
    keywords.some(kw => cap.capability.includes(kw) || cap.plugin.includes(kw) || cap.description.toLowerCase().includes(kw))
  );

  // UIKit components reutilizables que coinciden con keywords
  const uiKitMatches = (graph.shell.uiKitComponents || []).filter(c =>
    score(c.name, keywords) > 0
  );

  return {
    features: relevant.map(f => ({
      id: f.id,
      routes: f.routes,
      pages: f.pages.map(p => ({ name: p.name, isWebView: p.isWebView })),
      cubits: f.cubits.map(c => ({ name: c.name, states: c.states }))
    })),
    bridgeEvents: bridgeEvents.map(e => ({ name: e.name, direction: e.direction })),
    nativeCapabilities: nativeCaps,
    reuseableUIKit: uiKitMatches.map(c => ({ name: c.name, widgetType: c.widgetType, props: c.props, file: c.file }))
  };
}

// ── Preflight estático del MCP Pepino ─────────────────────────────────────
// Verificación rápida sin levantar subprocess. Para probe activo usar
// `node graph-builder/preflight.js <HU> --probe`.

function preflightMcpPepino() {
  const out = { server: 'pepino', status: 'ok', warnings: [] };
  if (!fs.existsSync(MCP_CONFIG)) {
    out.status = 'missing-config';
    out.warnings.push('.cursor/mcp.json no existe. El agente no podrá llamar al MCP Pepino.');
    return out;
  }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8')); }
  catch (e) {
    out.status = 'invalid-config';
    out.warnings.push(`mcp.json inválido: ${e.message}`);
    return out;
  }
  const pepino = cfg.mcpServers?.pepino;
  if (!pepino) {
    out.status = 'not-configured';
    out.warnings.push('mcp.json no declara el servidor "pepino". Las specs de pp-* no estarán disponibles en runtime.');
    return out;
  }
  const entry = pepino.args?.[0];
  if (!entry || !fs.existsSync(entry)) {
    out.status = 'entry-missing';
    out.warnings.push(`Entry del MCP Pepino no existe: ${entry || '(no especificado)'}. Compilar mcp-pepino/ (npm run build).`);
    return out;
  }
  out.entry = entry;
  return out;
}

// ── Cross edges relevantes ────────────────────────────────────────────────

function queryEdges(graph, keywords, matchedRemote) {
  return graph.crossEdges.filter(e => {
    if (e.type === 'mfe-calls-bff' && matchedRemote && e.from.includes(matchedRemote)) return true;
    if (e.type === 'shell-embeds-mfe' && matchedRemote && e.to.includes(matchedRemote)) return true;
    return false;
  });
}

// ── Main query ────────────────────────────────────────────────────────────

function query(intent, options = {}) {
  if (!fs.existsSync(GRAPH_PATH)) {
    throw new Error(`Graph not found at ${GRAPH_PATH}. Run: bash graph-builder/build-graph.sh`);
  }

  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf-8'));
  const keywords = expandKeywords(tokenize(intent));

  // Detectar remote objetivo
  const targetRemote = options.remote ||
    graph.mfe.remotes.find(r => score(r.id, keywords) > 1)?.id ||
    null;

  const mfeNodes     = queryMFE(graph, keywords, targetRemote);
  const shellContext = queryShell(graph, keywords);
  const edges        = queryEdges(graph, keywords, targetRemote);

  const subgraph = {
    intent,
    graphVersion: graph.version,
    builtAt: graph.builtAt,
    targetRemote,
    mfe: { remotes: mfeNodes },
    shell: shellContext,
    relevantEdges: edges,
    designSystem: {
      contract: 'pp-* declarados por HU (ver hus-graph.json); specs vía MCP Pepino en runtime',
      mcpPreflight: preflightMcpPepino()
    },
    meta: {
      mfeMatched:        mfeNodes.length,
      edgesMatched:      edges.length,
      nativeCapsMatched: shellContext.nativeCapabilities?.length || 0,
      uiKitMatched:      shellContext.reuseableUIKit?.length || 0,
      isShellOnly:       mfeNodes.length === 0 && (shellContext.nativeCapabilities?.length > 0)
    }
  };

  return subgraph;
}

// ── Token counter ─────────────────────────────────────────────────────────

function countTokens(obj) {
  return Math.ceil(JSON.stringify(obj).length / 4);
}

// ── CLI ───────────────────────────────────────────────────────────────────

module.exports = { query, countTokens };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
  const intent = args[0] || 'pantalla movimientos billetera servicios paginacion';
  const remote = args[1] || null;
  const compact = flags.includes('--compact');

  const result = query(intent, { remote });
  const tokens = countTokens(result);

  if (compact) {
    console.log(JSON.stringify(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
    console.error(`\n📊 Subgraph: ${JSON.stringify(result).length} bytes (~${tokens} tokens)`);
  }
}
