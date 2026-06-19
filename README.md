# workspace_fuel — Combustibles

Workspace **orquestador multi-repo** del dominio **Combustibles** (Flypass). No contiene código de producto: coordina specs funcionales, grafos semánticos y planes de implementación que afectan a los repos hijos.

## Repos hijos

Cada repo hijo es un repositorio independiente en GitHub. Deben clonarse **dentro** de esta carpeta:

| Directorio | Repositorio GitHub | Descripción |
|------------|--------------------|-------------|
| `frontend-micro-fuel/` | [f2x-flypass/frontend-micro-fuel](https://github.com/f2x-flypass/frontend-micro-fuel) | Monorepo Nx — MFEs Angular (fuel, fuel-policy, fuel-transaction, driver) |
| `backend-product-fuel-policy-enforcer/` | [f2x-flypass/backend-product-fuel-policy-enforcer](https://github.com/f2x-flypass/backend-product-fuel-policy-enforcer) | Backend APIs combustible, políticas y surtidor |
| `backend-customer-account-drivers/` | [f2x-flypass/backend-customer-account-drivers](https://github.com/f2x-flypass/backend-customer-account-drivers) | Backend APIs conductores y vehículos |
| `testing-api-combustiblesB2B/` | [f2x-flypass/testing-api-combustiblesB2B](https://github.com/f2x-flypass/testing-api-combustiblesB2B) | Tests de integración API (Karate / Gradle) |
| `testing-e2e-combustiblesB2B/` | [f2x-flypass/testing-e2e-combustiblesB2B](https://github.com/f2x-flypass/testing-e2e-combustiblesB2B) | Tests E2E (Playwright / TypeScript) |

## Setup inicial

```bash
# 1. Clonar este workspace orquestador
git clone https://github.com/f2x-flypass/workspace-fuel.git workspace_fuel
cd workspace_fuel

# 2. Clonar los repos hijos dentro del workspace
git clone https://github.com/f2x-flypass/frontend-micro-fuel.git
git clone https://github.com/f2x-flypass/backend-product-fuel-policy-enforcer.git
git clone https://github.com/f2x-flypass/backend-customer-account-drivers.git
git clone https://github.com/f2x-flypass/testing-api-combustiblesB2B.git
git clone https://github.com/f2x-flypass/testing-e2e-combustiblesB2B.git

# 3. Exportar variable de entorno (agregar al perfil de shell: ~/.bashrc o ~/.zshrc)
export KG_WORKSPACE_ROOT=$(pwd)

# 4. Verificar el kit
./tools/kg-cli version
./tools/kg-cli query flows
```

> **Nota:** Los repos hijos están en `.gitignore` de este repo — cada uno se versiona de forma independiente en su propio GitHub. Los cambios en specs funcionales (`specs/`) o en el grafo (`graph/`) sí se commitean aquí.

## Abrir en el IDE

Usar el archivo [`workspace_fuel.code-workspace`](workspace_fuel.code-workspace) para abrir todos los repos como carpetas raíz independientes en VS Code o Cursor:

```
File > Open Workspace from File... > workspace_fuel.code-workspace
```

Esto evita conflictos del Language Server entre repos con el mismo paquete Java (`co.com.flypass`).

## Estructura del workspace padre

```
workspace_fuel/
├── specs/                        ← specs funcionales (SPEC-FL2-*.md) y contratos
│   ├── README-combustibles.md    ← índice del dominio y flujo spec-first
│   ├── SPEC-FL2-*.md             ← specs funcionales (front-matter YAML)
│   ├── _api-fuel-policy.md       ← contrato API combustibles
│   ├── _api-drivers.md           ← contrato API conductores
│   └── _templates/               ← plantillas para nuevas specs
├── graph/                        ← grafos semánticos (generados con kg-cli, versionados)
│   ├── specs-graph.json          ← grafo de specs del dominio
│   └── flypass-graph.json        ← grafo de código multi-repo
├── docs/ai-development-kit/      ← guías operativas del kit de IA
├── tools/kg-cli                  ← CLI del grafo semántico
├── runs/                         ← planes y evidencia de sesión (local, en .gitignore)
└── workspace_fuel.code-workspace ← config multi-root para VS Code / Cursor
```

## Flujo de trabajo (spec-first)

```
Jira ticket  →  skill jira-to-spec  →  specs/SPEC-FL2-*.md
    ↓
kg-cli index specs  →  kg-cli query spec-slice <SPEC-ID>
    ↓
G1: plan JSON aprobado  →  implementación en repos hijos
    ↓
Arnés por repo  →  G2: tests verdes  →  push en cada repo hijo
    ↓
Actualizar spec (status: implemented)  →  kg-cli index specs  →  commitear grafo
```

Guía completa: [`docs/ai-development-kit/workspace.md`](docs/ai-development-kit/workspace.md)

## Comandos frecuentes

```bash
# Indexar tras cambios en specs/ o código (commitear graph/*.json después)
./tools/kg-cli index specs
./tools/kg-cli index code

# Consultar contexto de una spec (slice eficiente — ~94% menos tokens que cargar todo)
./tools/kg-cli query spec-slice SPEC-FL2-XXXXX

# Ver flujos del dominio y orden de implementación
./tools/kg-cli query flows
./tools/kg-cli query flow-order

# Importar tickets desde Jira (requiere MCP Atlassian)
# Invocar skill jira-to-spec en el agente de IA
```

## Estado actual

- Flujo spec-first activo — ver [`specs/README-combustibles.md`](specs/README-combustibles.md)
- Specs técnicas indexables: FPE-0000…0008, CAD-0000…0001, MFE-0000…0001
- Contratos API: [`specs/_api-fuel-policy.md`](specs/_api-fuel-policy.md), [`specs/_api-drivers.md`](specs/_api-drivers.md)
