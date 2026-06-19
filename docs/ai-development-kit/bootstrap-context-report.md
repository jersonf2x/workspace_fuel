# Bootstrap Context Report

| Field | Value |
|---|---|
| Repo | `workspace_fuel` |
| Target | `/home/jerso/workspace_fuel` |
| Generated at | `2026-06-10T11:22:19-0500` |
| Apply mode | `true` |
| Graph index | `ok` |

## Confirmed By Files

### Stack

- `Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/backend_module/package.json`
- `Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/package.json`
- `Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/backend_module/package.json`
- `Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/package.json`
- `Node.js / frontend-micro-fuel/package.json`
- `Angular / frontend-micro-fuel`
- `TypeScript / frontend-micro-fuel`
- `Node.js / frontend-micro-fuel/packages/mfe-driver/package.json`
- `Angular / frontend-micro-fuel/packages/mfe-driver`
- `Node.js / frontend-micro-fuel/packages/mfe-fuel-policy/package.json`
- `Angular / frontend-micro-fuel/packages/mfe-fuel-policy`
- `Node.js / frontend-micro-fuel/packages/mfe-fuel-transaction/package.json`
- `Angular / frontend-micro-fuel/packages/mfe-fuel-transaction`
- `Node.js / frontend-micro-fuel/packages/mfe-fuel/package.json`
- `Angular / frontend-micro-fuel/packages/mfe-fuel`
- `Node.js / frontend-micro-fuel/packages/shared-utils/package.json`
- `Angular / frontend-micro-fuel/packages/shared-utils`
- `Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/frontend_module/package.json`
- `Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/graph_module/package.json`

### Commands

- `cd frontend-micro-fuel && npm run build # npx nx run-many -t build package`
- `cd frontend-micro-fuel && npm run test # npx nx run-many -t test`
- `cd frontend-micro-fuel && npm run lint # npx nx run-many -t lint`
- `cd frontend-micro-fuel && npm run start # npx nx serve host`

### Source Roots

- No common source root detected.

### Test Roots

- No common test root detected.

### Docs And AI Kit Roots

- `docs`
- `specs`
- `hus`
- `graph`
- `runs`
- `.specify`

### Config Files

- No known config files detected.

## Module Applicability

| Module | Evidence | Recommendation |
|---|---|---|
| `core` | `docs/ai-development-kit/adoption.md`, `.specify/`, `CLAUDE.md` | Keep mandatory. Use this report to complete repo memory. |
| `backend_module` | Backend evidence or installed backend docs found. | Complete contracts, runbooks, ADRs and prereview for backend changes. |
| `frontend_module` | Frontend evidence or installed frontend docs found. | Use HU templates, BEM rules and prereview for UI changes. |
| `graph_module` | `tools/kg-cli` is executable. | Use graph/context packets for feature work and context minimization. |

## Backend Evidence

- `backend-customer-account-drivers/.github/workflows/create-repository.yml`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/exception/DriverAlreadyExistsException.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/exception/DriverNotFoundException.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/exception/ValidationException.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/ports/outbound/DriverInfoRepositoryPort.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/ports/outbound/DriverRepositoryPort.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/model/ports/outbound/OutboxRepositoryPort.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/service/OutboxEventService.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/AddVehicleDriverUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/CreateDriverUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/DeleteDriversUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/DeleteVehicleDriverUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetDriverByDocumentUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetDriverByDriverIdUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetDriversByDocumentNumberUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetDriversByPlateUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetDriversBySubaccountUseCase.java`
- `backend-customer-account-drivers/src/main/java/co/com/flypass/customer/account/domain/usecase/GetPlateDriverCountUseCase.java`

## Frontend Evidence

- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/cross-edge-builder.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/generic-code-indexer.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/hu-indexer.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/mfe-indexer.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/preflight.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/query-engine.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/query-hu-graph.js`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/shell-indexer.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/cross-edge-builder.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/generic-code-indexer.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/hu-indexer.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/mfe-indexer.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/preflight.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/query-engine.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/query-hu-graph.js`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/lib/shell-indexer.js`
- `frontend-micro-fuel/apps/host-e2e/src/lib/angular-debug.ts`
- `frontend-micro-fuel/apps/host-e2e/src/lib/msw-bootstrap.ts`

## Contract Evidence

- `backend-customer-account-drivers/docs/ai-development-kit/backend/examples/templates/contracts/openapi.template.yml`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/backend_module/examples/templates/contracts/openapi.template.yml`
- `backend-product-fuel-policy-enforcer/docs/ai-development-kit/backend/examples/templates/contracts/openapi.template.yml`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/backend_module/examples/templates/contracts/openapi.template.yml`
- `backend-customer-account-drivers/docs/ai-development-kit/backend/examples/templates/contracts/asyncapi.template.yml`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/backend_module/examples/templates/contracts/asyncapi.template.yml`
- `backend-product-fuel-policy-enforcer/docs/ai-development-kit/backend/examples/templates/contracts/asyncapi.template.yml`
- `backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/backend_module/examples/templates/contracts/asyncapi.template.yml`
- `backend-customer-account-drivers/graph/.schemas/context-packet.schema.json`
- `backend-customer-account-drivers/graph/.schemas/flypass-graph.schema.json`
- `backend-customer-account-drivers/graph/.schemas/hus-graph.schema.json`
- `backend-customer-account-drivers/graph/.schemas/i18n-registry.schema.json`
- `backend-customer-account-drivers/graph/.schemas/plan-macro.schema.json`
- `backend-customer-account-drivers/graph/.schemas/qa-coverage-graph.schema.json`
- `backend-customer-account-drivers/graph/.schemas/test-plan.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/context-packet.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/flypass-graph.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/hus-graph.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/i18n-registry.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/plan-macro.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/qa-coverage-graph.schema.json`
- `backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/lib/schemas/test-plan.schema.json`
- `backend-product-fuel-policy-enforcer/graph/.schemas/context-packet.schema.json`
- `backend-product-fuel-policy-enforcer/graph/.schemas/flypass-graph.schema.json`
- `backend-product-fuel-policy-enforcer/graph/.schemas/hus-graph.schema.json`
- `backend-product-fuel-policy-enforcer/graph/.schemas/i18n-registry.schema.json`

## Graph Evidence

- `graphify.config.json`
- `graph/.schemas/`
- `hus/`
- `docs/contracts/`

### Code Graph Summary

| Field | Value |
|---|---:|
| Generic nodes | `31` |
| Generic edges | `5` |
| Backend services | `0` |
| Backend handlers | `0` |
| Shared modules | `0` |
| Frontend components | `26` |
| Frontend routes | `0` |
| Infrastructure resources | `0` |
| Cross edges | `5` |

## Proposed Updates

The report is safe to review. Run with `--apply` to write generated sections to:

- `.specify/memory/domain-context.md`
- `.specify/memory/repo-architecture.md`
- `docs/ai-development-kit/repo-context-pack.md`
- `CLAUDE.md` repo-specific render when it is still templated, otherwise managed bootstrap section

### Proposed Repo Summary

- Repo: `workspace_fuel`
- Detected stack: `Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/backend_module/package.json, Node.js / backend-customer-account-drivers/tools/modular-dev-ai-kit/graph_module/package.json, Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/backend_module/package.json, Node.js / backend-product-fuel-policy-enforcer/tools/modular-dev-ai-kit/graph_module/package.json, Node.js / frontend-micro-fuel/package.json, Angular / frontend-micro-fuel, TypeScript / frontend-micro-fuel, Node.js / frontend-micro-fuel/packages/mfe-driver/package.json, Angular / frontend-micro-fuel/packages/mfe-driver, Node.js / frontend-micro-fuel/packages/mfe-fuel-policy/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel-policy, Node.js / frontend-micro-fuel/packages/mfe-fuel-transaction/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel-transaction, Node.js / frontend-micro-fuel/packages/mfe-fuel/package.json, Angular / frontend-micro-fuel/packages/mfe-fuel, Node.js / frontend-micro-fuel/packages/shared-utils/package.json, Angular / frontend-micro-fuel/packages/shared-utils, Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/frontend_module/package.json, Node.js / frontend-micro-fuel/tools/modular-dev-ai-kit/graph_module/package.json`
- Source roots: `not-detected`
- Test roots: `not-detected`
- Commands: `cd frontend-micro-fuel && npm run build # npx nx run-many -t build package, cd frontend-micro-fuel && npm run test # npx nx run-many -t test, cd frontend-micro-fuel && npm run lint # npx nx run-many -t lint, cd frontend-micro-fuel && npm run start # npx nx serve host`
- Backend evidence count: `18`
- Frontend evidence count: `18`
- Contract evidence count: `26`

## Anti-hallucination Notes

- Confirmed facts above are path-based heuristics.
- Inferred ownership, domain and bounded context still require human review.
- Do not treat absence of evidence as absence of capability until repo owners confirm.

## Warnings

- No warnings.
