#!/usr/bin/env bash
# install.sh — instala @f2x/semantic-graph-kg en TARGET_DIR.
#
# Uso:
#   bash packages/kg/install.sh [TARGET_DIR]
#
# Efecto:
#   - Crea graph/, specs/, runs/ si faltan.
#   - Copia schemas a graph/.schemas/.
#   - Symlinkea kg-cli en TARGET/node_modules/.bin/ si hay package.json.
#   - Si no hay package.json en TARGET, sugiere `npm link`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-.}"
TARGET="$(cd "$TARGET" && pwd)"

echo "════════════════════════════════════════════════════════"
echo "  @f2x/semantic-graph-kg — install"
echo "  TARGET: $TARGET"
echo "════════════════════════════════════════════════════════"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node >= 18 requerido"
  exit 1
fi

# 1. Directorios base
for d in graph specs runs; do
  mkdir -p "$TARGET/$d"
  [[ -e "$TARGET/$d/.gitkeep" ]] || touch "$TARGET/$d/.gitkeep"
done

# 2. Schemas
mkdir -p "$TARGET/graph/.schemas"
cp "$SCRIPT_DIR/lib/schemas/"*.schema.json "$TARGET/graph/.schemas/"
echo "  ✓ schemas → graph/.schemas/"

# 3. Verificar CLI
node "$SCRIPT_DIR/bin/kg-cli.js" version
echo ""
echo "  ✓ kg-cli OK"
echo ""
echo "  Próximo paso:"
echo "    cd $TARGET"
echo "    node $SCRIPT_DIR/bin/kg-cli.js index specs"
echo ""
echo "  Para tener kg-cli en PATH:"
echo "    cd $SCRIPT_DIR && npm link"
echo "════════════════════════════════════════════════════════"
