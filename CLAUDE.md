# CLAUDE.md - workspace_fuel (Combustibles)

> Workspace coordinador multi-repo. Flujo **spec-first** — 2026-06-11.

## Mission

Coordinar el desarrollo del dominio **Combustibles** across tres repos: frontend MFE, backend fuel policy y backend conductores. Las specs funcionales viven aquí en `specs/`; las specs técnicas y el código viven en los repos hijos.

## Ownership

- Domain: `combustibles`
- Workspace root: `/home/jerso/workspace_fuel`
- Kit modules (padre): `core`, `graph_module`
- Guía operativa: `docs/ai-development-kit/workspace.md`
- Flujo activo: `specs/README-combustibles.md`

## Repos hijos

| Repo | Responsabilidad | Prefijo spec |
|------|-----------------|--------------|
| `frontend-micro-fuel` | MFEs Nx: fuel, fuel-policy, fuel-transaction, driver | `MFE-` |
| `backend-product-fuel-policy-enforcer` | APIs combustible / políticas / surtidor | `FPE-` |
| `backend-customer-account-drivers` | APIs conductores y vehículos | `CAD-` |

## Modelo spec-first (dos niveles)

- **Funcional** (`specs/SPEC-FL2-*.md`, este workspace): qué + criterios + repos impactados. Front-matter YAML obligatorio.
- **Técnica** (`<repo>/specs/000X_SPEC_*.md`): cómo, por repo; enlaza la funcional vía `refines:`.
- **Contexto** (`<repo>/specs/0000_SPEC_project_context.md`): siempre se lee primero al trabajar en un repo.
- Specs **vivas**: todo cambio sustantivo actualiza la spec y reindexa. Si spec y código divergen, preguntar antes de codificar.

## Non-negotiable rules

- **Siempre** `export KG_WORKSPACE_ROOT=/home/jerso/workspace_fuel` o trabajar desde esta carpeta.
- Una spec por sesión; plan JSON en `runs/plan-<SPEC-ID>.json` antes de codificar (G1).
- UI web: convenciones del repo frontend + MCP Figma. Sin Figma utilizable (node-id) → bloqueante para UI.
- Contratos en `specs/_api-*.md` deben alinearse con cambios de API.
- No commitear secretos. `graph/` y `runs/` están en `.gitignore` del padre.

## Graph-first workflow

```bash
./tools/kg-cli index specs # tras cambios en specs/ (padre o repos hijos)
./tools/kg-cli index code # tras cambios estructurales en repos
./tools/kg-cli query flows # los 3 flujos de negocio (b2c-supply-completed, b2c-supply-in-progress, b2b)
./tools/kg-cli query flow-order
./tools/kg-cli query spec-slice <SPEC-ID>
./tools/kg-cli preflight <SPEC-ID>
```

Preferir `kg-cli query spec-slice` antes de búsqueda manual amplia.

## Estado del flujo

- Épico Jira: **pendiente**
- Specs funcionales en `specs/`: **ninguna aún** — listo para sincronizar desde Jira MCP
- Specs técnicas indexables: FPE-0000…0007, CAD-0000…0001, MFE-0000 (stub)
- Contratos: `specs/_api-fuel-policy.md`, `specs/_api-drivers.md`

## Cuando llegue un ticket de Jira

Usar skill **`jira-to-spec`** (`.cursor/skills/jira-to-spec/`) para sincronizar épico/stories desde MCP Atlassian.

Manual (si aplica):

1. Crear `specs/SPEC-FL2-XXXXX-<slug>.md` desde `specs/_templates/SPEC-FL2-XXXXX.template.md`.
2. Crear specs técnicas en los repos impactados desde `specs/_templates/spec-tecnica.template.md`.
3. Actualizar índice en `specs/README-combustibles.md`.
4. `kg-cli index specs` → `@implement SPEC-FL2-XXXXX` con plan → G1 → código en repos hijos → arnés → prereview → G2 → actualizar spec + reindex.

## Deeper docs

- Workspace: `docs/ai-development-kit/workspace.md`
- Adoption: `docs/ai-development-kit/adoption.md`
- Frontend guides (en repo hijo): `frontend-micro-fuel/docs/ai-development-kit/frontend/guides/`
- Backend guides (en repos hijo): `docs/ai-development-kit/backend/` si aplica

<!-- modular_dev_ai_kit:bootstrap-context:start -->
## Repo Bootstrap Context

- Last bootstrap: `2026-06-10T11:22:19-0500`
- Report: `docs/ai-development-kit/bootstrap-context-report.md`
- Detected stack: `Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/backend_module/package.json, Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/package.json, Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/backend_module/package.json, Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/package.json, Node.js / frontend-micro-fuel/package.json, Angular / frontend-micro-fuel, TypeScript / frontend-micro-fuel, Node.js / frontend-micro-fuel/packages/mfe-driver/package.json, Angular / frontend-micro-fuel/packages/mfe-driver, Node.js / frontend-micro-fuel/packages/mfe-fuel-policy/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel-policy, Node.js / frontend-micro-fuel/packages/mfe-fuel-transaction/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel-transaction, Node.js / frontend-micro-fuel/packages/mfe-fuel/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel, Node.js / frontend-micro-fuel/packages/shared-utils/package.json, Angular / frontend-micro-fuel/packages/shared-utils, Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/frontend_module/package.json, Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/graph_module/package.json`
- Source roots: `not-detected`
- Installed AI kit modules: `core, graph_module`
- Kit-first mode: follow installed kit docs, context packs, specs, templates and module checklists before ad hoc process.
- Graph-first context: prefer graph/context lookup for dependency, impact and navigation questions before broad repo search; use bounded slices or summaries to optimize tokens.
- Before feature work, review `.specify/memory/repo-architecture.md`, `docs/ai-development-kit/repo-context-pack.md`, and the relevant installed templates.
<!-- modular_dev_ai_kit:bootstrap-context:end -->
