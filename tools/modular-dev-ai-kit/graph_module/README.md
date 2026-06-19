# Graph Module

Modulo de grafo de `modular_dev_ai_kit`, basado en `@f2x/semantic-graph-kg`.

Preserva el contrato `kg-cli@0.4.0`: indexers, queries, JSON Schemas, outputs parseables y exit codes deterministas. No depende de `.claude/`.

## Instalacion en repos destino

```bash
bash kits/modular_dev_ai_kit/tools/install.sh --target . --modules graph
./tools/kg-cli version
```

El instalador copia fisicamente este modulo a:

```text
tools/modular-dev-ai-kit/graph_module/
```

Y crea un wrapper local:

```text
tools/kg-cli
```

## Contrato CLI (estable, semver)

```bash
kg-cli init                              # crea graph/, specs/, runs/, schemas en graph/.schemas/
kg-cli version                           # → JSON { kg_cli, schema, node }
kg-cli schema [specs-graph|flypass-graph|context-packet]

kg-cli index specs                       # → graph/specs-graph.json
kg-cli index code                        # → graph/flypass-graph.json
kg-cli index mfe                         # MFE slice
kg-cli index shell                       # Shell slice

kg-cli preflight <SPEC-ID> [--json] [--all]
kg-cli query flow-order [--json]
kg-cli query spec-slice <SPEC-ID> [--tokens] [--raw-cmp]

kg-cli probe                             # Claude/MCP handshake
```

- Stdout: JSON o texto humano según flag.
- Exit codes: `0` ok, `1` warn, `2` error.

## Schemas

Versionados en `lib/schemas/`. Cualquier breaking change incrementa MAJOR del paquete.

| Schema | Cubre |
|---|---|
| `specs-graph.schema.json` | Grafo de specs (funcionales + técnicas + contexto, nodos + edges) |
| `flypass-graph.schema.json` | Grafo de código (MFE + Shell + generic backend/frontend/infra + crossEdges) |
| `context-packet.schema.json` | Envelope que el agente recibe (provenance, bounded slices) |

## Estructura

```
modules/graph_module/
├── bin/kg-cli.js
├── lib/
│   ├── _config.js
│   ├── _anthropic-client.js
│   ├── spec-indexer.js
│   ├── mfe-indexer.js
│   ├── shell-indexer.js
│   ├── generic-code-indexer.js
│   ├── cross-edge-builder.js
│   ├── query-flow-order.js
│   ├── query-spec-graph.js
│   ├── query-engine.js
│   ├── preflight.js
│   ├── claude-probe.js
│   └── schemas/*.schema.json
├── scripts/build-graph.sh
├── templates/graphify.config.json.template
└── install.sh
```

## Uso programático (Node)

```js
const { loadConfig } = require('./tools/modular-dev-ai-kit/graph_module/lib/_config');
const cfg = loadConfig();
```

## Compatibilidad

- Consumido por `frontend_module` vía CLI.
- No depende de `.claude/` ni de nada de IDE.
- `kg-cli index code` preserva MFE/Shell y agrega `generic` para repos Python, React, CloudFormation o mixtos.

## Monorepos Nx + Angular

Instalaciones nuevas siembran `graphify.config.json` con preset Nx (`mfeRoot: "."`, `mfeAppsDir: "apps"`).

`tools/bootstrap-context --apply` detecta `nx.json` + `apps/` y corrige configs legacy; no sembra `shellRoot` en repos MFE-only.

Guía: [docs/NX-ANGULAR-PRESET.md](docs/NX-ANGULAR-PRESET.md).

El `mfe-indexer` indexa componentes por `*.component.ts` o por decorador `@Component` (Angular standalone flat).
