# Workspace Fuel — Guía operativa (spec-first)

Coordinador multi-repo del dominio **Combustibles**. No es un repo de producto: orquesta specs, grafos y planes que afectan varios repos hijos.

## Estructura

```
workspace_fuel/
├── graphify.config.json      ← config multi-repo (NO sobrescribir sin revisar)
├── CLAUDE.md                 ← contexto del agente para todo el workspace
├── specs/                    ← specs funcionales + contratos (fuente de verdad del flujo)
│   ├── README-combustibles.md
│   ├── SPEC-FL2-*.md         ← specs funcionales (front-matter YAML)
│   ├── _api-*.md             ← contratos API
│   └── _templates/
├── graph/                    ← grafos generados (gitignored)
├── runs/                     ← plans y prereviews (gitignored)
├── tools/kg-cli              ← CLI del grafo
├── frontend-micro-fuel/      ← repo git (MFE Nx) — specs técnicas MFE-*
├── backend-product-fuel-policy-enforcer/   — specs técnicas FPE-*
└── backend-customer-account-drivers/       — specs técnicas CAD-*
```

## Modelo de specs en dos niveles

| Nivel | Dónde | Contiene |
|-------|-------|----------|
| Funcional (`type: functional`) | `specs/SPEC-FL2-*.md` (padre) | Qué + criterios + repos impactados |
| Técnica (`type: technical`) | `<repo>/specs/000X_SPEC_*.md` | Cómo, por repo; `refines:` → funcional |
| Contexto (`type: context`) | `<repo>/specs/0000_SPEC_project_context.md` | Contexto base del repo |

El front-matter YAML (id, type, status, repo/repos, refines, depends_on, entities, endpoints, figma) es lo que indexa `kg-cli index specs`.

## Variables de entorno

Siempre trabajar desde el workspace padre o exportar:

```bash
export KG_WORKSPACE_ROOT=/home/jerso/workspace_fuel
cd /home/jerso/workspace_fuel
```

## Comandos de arranque

```bash
cd /home/jerso/workspace_fuel

# Verificar kit
./tools/kg-cli version

# Indexar (re-ejecutar tras cambios en specs/ o código)
./tools/kg-cli index specs
./tools/kg-cli index code

# Flujos de negocio del dominio (definidos en specs/0000_SPEC_contexto_dominio_combustibles.md)
./tools/kg-cli query flows

# Orden de implementación del flujo
./tools/kg-cli query flow-order

# Por spec:
./tools/kg-cli query spec-slice <SPEC-ID>
./tools/kg-cli preflight <SPEC-ID>
./tools/kg-cli generate implement-prompt <SPEC-ID>
```

## Skill jira-to-spec

Cursor skill en `.cursor/skills/jira-to-spec/` (espejo en `.claude/skills/jira-to-spec/`).

```text
Usa el skill jira-to-spec para importar el épico FL2-XXXXX a specs/
```

Automatiza: MCP Atlassian → `specs/SPEC-FL2-*.md` → actualizar `README-combustibles.md` → `kg-cli index specs`.

## Flujo per-feature

1. **Skill jira-to-spec** (o Jira MCP manual) → leer épico/stories.
2. **Materializar** `specs/SPEC-FL2-*.md` (plantillas en `specs/_templates/`).
3. **Derivar** specs técnicas en los repos impactados (`refines:`).
4. **Indexar** → `kg-cli index specs`.
5. **Plan macro** → `@implement flujo completo combustibles` (sin código).
6. **Por spec** → implementar en repos según `runs/plan-<SPEC-ID>.json` (G1 aprobado).
7. **Arnés** en cada repo tocado → prereview → G2 → push/PR.
8. **Actualizar spec** con lo realmente construido → `kg-cli index specs`.

## Repos hijos — dónde implementar

| Cambio | Repo | Arnés típico |
|--------|------|--------------|
| API combustibles | `backend-product-fuel-policy-enforcer` | `./mvnw test` |
| API conductores | `backend-customer-account-drivers` | `./mvnw test` |
| UI MFE | `frontend-micro-fuel` | `tools/harness/hu-checkpoint.sh <remote> <SPEC-ID>` |

## Abrir en Cursor

Abrir la carpeta **`/home/jerso/workspace_fuel`** como workspace raíz (no solo un repo hijo) para que el agente vea specs, grafos y los tres repos.

## Estado actual

- Kit coordinador: `core` + `graph_module` instalados en el padre (flujo spec-first).
- Kit de producto instalado en los 3 repos hijos.
- Flujo `combustibles` en `specs/README-combustibles.md`.
- Specs técnicas indexables: FPE-0000…0007, CAD-0000…0001, MFE-0000 (stub).
- **Pendiente:** specs funcionales desde Jira, OpenAPI completos en `specs/_api-*.md`.
