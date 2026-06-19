#!/usr/bin/env bash
# build-graph.sh — Construye flypass-graph.json desde MFE y Shell.
#
# Uso:
#   bash graph-builder/build-graph.sh                       # full rebuild
#   bash graph-builder/build-graph.sh --incremental --domain=mfe   # solo MFE
#   bash graph-builder/build-graph.sh --incremental --domain=shell # solo Shell
#
# Output: graph/flypass-graph.json
#
# NOTA — Este grafo NO incluye el Design System (Pepino).
# El contrato con el DS vive en las specs (spec-indexer.components) y la
# resolución de specs se hace en runtime vía MCP Pepino. Ver README o
# graph-builder/cross-edge-builder.js para detalles.

set -euo pipefail

PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$PKG_ROOT/lib"

if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install Node.js >= 18."
  exit 1
fi

WORKSPACE="$(KG_PKG_ROOT="$PKG_ROOT" node <<'NODE'
const path = require('path');
const { loadConfig } = require(path.join(process.env.KG_PKG_ROOT, 'lib/_config'));
process.stdout.write(loadConfig().paths.root);
NODE
)"
OUTPUT="$(KG_PKG_ROOT="$PKG_ROOT" node <<'NODE'
const path = require('path');
const { loadConfig } = require(path.join(process.env.KG_PKG_ROOT, 'lib/_config'));
process.stdout.write(loadConfig().paths.codeGraph);
NODE
)"
WORKSPACE_NAME="$(KG_PKG_ROOT="$PKG_ROOT" node <<'NODE'
const path = require('path');
const { loadConfig } = require(path.join(process.env.KG_PKG_ROOT, 'lib/_config'));
process.stdout.write(loadConfig().workspaceName || 'workspace');
NODE
)"
OUTPUT_DIR="$(dirname "$OUTPUT")"
TMP="$OUTPUT_DIR/tmp"

mkdir -p "$OUTPUT_DIR" "$TMP"

# ── Args ───────────────────────────────────────────────────────────────────
INCREMENTAL=false
DOMAIN="all"

for arg in "$@"; do
  case $arg in
    --incremental) INCREMENTAL=true ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
  esac
done

START=$(date +%s)
echo "🔨 Flypass Graph Builder"
echo "   Mode: $([ "$INCREMENTAL" = true ] && echo "incremental ($DOMAIN)" || echo "full rebuild")"
echo "   Output: $OUTPUT"
echo "   Workspace: $WORKSPACE"
echo ""

# ── Full rebuild o incremental ─────────────────────────────────────────────

if [ "$INCREMENTAL" = false ] || [ "$DOMAIN" = "mfe" ]; then
  echo "⚡ Indexing MFE remotes (Angular/Nx)..."
  (cd "$WORKSPACE" && node "$LIB_DIR/mfe-indexer.js") > "$TMP/mfe.json"
  MFE_COUNT=$(node -e "const d=require('$TMP/mfe.json'); console.log(d.remotes.length)")
  echo "   ✓ $MFE_COUNT remotes"
fi

if [ "$INCREMENTAL" = false ] || [ "$DOMAIN" = "shell" ]; then
  echo "🐦 Indexing Shell Flutter (features + UI kit)..."
  (cd "$WORKSPACE" && node "$LIB_DIR/shell-indexer.js") > "$TMP/shell.json"
  FEAT_COUNT=$(node -e "const d=require('$TMP/shell.json'); console.log(d.features.length)")
  BRIDGE_COUNT=$(node -e "const d=require('$TMP/shell.json'); console.log(d.bridgeEvents.length)")
  echo "   ✓ $FEAT_COUNT features, $BRIDGE_COUNT bridge events"
fi

if [ ! -f "$TMP/mfe.json" ]; then
  (cd "$WORKSPACE" && node "$LIB_DIR/mfe-indexer.js") > "$TMP/mfe.json"
fi

if [ ! -f "$TMP/shell.json" ]; then
  (cd "$WORKSPACE" && node "$LIB_DIR/shell-indexer.js") > "$TMP/shell.json"
fi

echo "🧭 Indexing generic repo code (backend + frontend + infrastructure)..."
(cd "$WORKSPACE" && node "$LIB_DIR/generic-code-indexer.js") > "$TMP/generic.json"
GENERIC_SUMMARY=$(node -e "const d=require('$TMP/generic.json'); console.log(JSON.stringify(d.summary))")
echo "   ✓ $GENERIC_SUMMARY"

# ── Cross-edges ────────────────────────────────────────────────────────────
echo "🔗 Building cross-domain edges..."
node -e "
const { buildCrossEdges } = require('$LIB_DIR/cross-edge-builder.js');
const mfe = require('$TMP/mfe.json');
const shell = require('$TMP/shell.json');
process.stdout.write(JSON.stringify(buildCrossEdges(mfe, shell), null, 2));
" > "$TMP/cross-edges.json"
EDGE_COUNT=$(node -e "const d=require('$TMP/cross-edges.json'); console.log(d.edges.length)")
echo "   ✓ $EDGE_COUNT cross-domain edges"

# ── Merge en grafo final ───────────────────────────────────────────────────
echo "📝 Writing $OUTPUT..."
WORKSPACE_NAME="$WORKSPACE_NAME" OUTPUT="$OUTPUT" TMP="$TMP" node <<'NODE'
const path = require('path');
const fs = require('fs');
const tmp = process.env.TMP;
const mfe = require(path.join(tmp, 'mfe.json'));
const shell = require(path.join(tmp, 'shell.json'));
const xEdges = require(path.join(tmp, 'cross-edges.json'));
const generic = require(path.join(tmp, 'generic.json'));

const nodes = [
  ...mfe.remotes.map((remote) => ({ id: remote.id, type: 'mfe_remote', dir: remote.dir })),
  ...shell.features.map((feature) => ({ id: feature.id, type: 'shell_feature' })),
  ...shell.uiKitComponents.map((component) => ({ id: component.name, type: 'shell_uikit_component', file: component.file })),
  ...(generic.nodes || [])
];

const graph = {
  version: '2.0',
  builtAt: new Date().toISOString(),
  workspace: process.env.WORKSPACE_NAME || 'workspace',
  note: 'Design System is not embedded in this graph. HU declarations and runtime tools resolve UI contracts. Generic repo indexing covers backend, frontend and infrastructure when Flypass MFE/Shell roots are not present.',
  nodes,
  summary: {
    mfeRemotes: mfe.remotes.length,
    shellFeatures: shell.features.length,
    uiKitComponents: shell.uiKitComponents.length,
    bridgeEvents: shell.bridgeEvents.length,
    crossEdges: xEdges.edges.length + generic.edges.length,
    legacyCrossEdges: xEdges.edges.length,
    genericNodes: generic.summary.genericNodes || (generic.nodes || []).length,
    backendHandlers: generic.summary.backendHandlers,
    backendServices: generic.summary.backendServices,
    backendSchemas: generic.summary.backendSchemas,
    sharedModules: generic.summary.sharedModules,
    frontendComponents: generic.summary.frontendComponents,
    frontendApiClients: generic.summary.frontendApiClients,
    frontendRoutes: generic.summary.frontendRoutes,
    infraResources: generic.summary.infraResources,
    genericEdges: generic.summary.genericEdges
  },
  mfe,
  shell,
  generic,
  crossEdges: [...xEdges.edges, ...generic.edges]
};

fs.writeFileSync(process.env.OUTPUT, JSON.stringify(graph, null, 2));
console.log(JSON.stringify(graph.summary, null, 2));
NODE

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo "✅ Graph built in ${ELAPSED}s → $OUTPUT"
echo ""

# ── Token estimate ─────────────────────────────────────────────────────────
SIZE=$(wc -c < "$OUTPUT")
TOKENS=$(( SIZE / 4 ))
echo "📊 Graph size: ${SIZE} bytes (~${TOKENS} tokens full load)"
echo "   Typical subgraph query: ~300–800 tokens"
echo "   UI contracts: resolve at runtime through the configured design-system source"
