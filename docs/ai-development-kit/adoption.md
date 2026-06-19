---
kit: modular_dev_ai_kit
version: 0.1.0-foundation
installed_at: 2026-06-10T11:21:21-0500
owner: AI Platform
modules_requested:
  - graph
modules_resolved:
  - core
  - graph_module
installer_version: 0.1.0-foundation
source_commit: 5b6dcdf
---

# AI Development Kit Adoption — workspace_fuel

| Campo | Valor |
|---|---|
| Source repository | `f2x-flypass/ai-development-kit` |
| Kit | `modular_dev_ai_kit` |
| Kit version | `0.1.0-foundation` |
| Rol | **Workspace coordinador** (multi-repo) |
| Adopted modules (padre) | `core`, `graph_module` |
| Adoption date | `2026-06-10` |
| Domain | `combustibles` |

## Repos hijos con kit instalado

| Repo | Módulos |
|------|---------|
| `frontend-micro-fuel` | `core`, `frontend_module`, `graph_module` |
| `backend-product-fuel-policy-enforcer` | `core`, `backend_module`, `graph_module` |
| `backend-customer-account-drivers` | `core`, `backend_module`, `graph_module` |

## Local Changes

- `graphify.config.json` personalizado para paths multi-repo.
- Flujo spec-first en `specs/README-combustibles.md` (specs funcionales pendientes de Jira).
- Contratos stub: `specs/_api-fuel-policy.md`, `specs/_api-drivers.md`.

## Validation Evidence

- `./tools/kg-cli version` — OK
- `./tools/kg-cli index specs` — OK (specs técnicas FPE/CAD/MFE indexadas)
- `./tools/kg-cli index code` — pendiente / ejecutar tras setup
