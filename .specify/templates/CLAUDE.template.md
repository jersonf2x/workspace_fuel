# CLAUDE.md - {repo_name}

## Mission

{repo_name} owns {primary_responsibility} for bounded context `{bounded_context}`.

## Ownership

- Functional owner: {product_owner}
- Technical owner: {technical_lead}
- Architecture owner: {solution_architect}
- Domain: {domain}

## Non-negotiable rules

- Preserve domain and module boundaries.
- Do not access another bounded context database.
- Do not introduce secrets, tokens or sensitive data.
- Keep API and event contracts updated with code.
- Ask before changing cross-domain contracts or architecture.

## Architecture

- Style: {architecture_style}
- Main modules: {modules}
- Domain code must not depend on infrastructure or framework details.
- Adapters live outside domain and application core.

## AI Kit Operating Mode

- Treat the installed AI kit modules as the default workflow for this repo.
- Start from this file, the adoption record, repo memory and context packs before implementation.
- Use installed kit instructions, module docs, templates and checklists instead of inventing a parallel process.
- If `graph_module` is installed, prefer graph/context lookup for dependency, impact and navigation questions before broad manual search.
- Use bounded graph slices or summaries to reduce token load; fall back to normal search only when graph context is missing, stale or exact text is required.
- For feature work, use the installed Spec Kit templates and preserve traceability from spec to plan, tasks, contracts and evidence.

## Inputs and outputs

| Type | Name | Owner |
|---|---|---|
| API exposed | {api} | {owner} |
| Event published | {event} | {owner} |
| Event consumed | {event} | {owner} |

## External dependencies

- {dependency}: {purpose}

## Commands

```bash
{build_command}
{unit_test_command}
{integration_test_command}
{lint_or_static_analysis_command}
```

## Testing expectations

- Unit tests for business rules.
- Integration tests for persistence, messaging or external adapters.
- Contract tests for API/event changes.
- Architecture tests for boundaries when modules change.

## Security

- Never log sensitive data.
- Never commit secrets.
- Validate auth, authorization and input boundaries.
- Use placeholders for credentials.

## Observability

- Structured logs are required.
- Include correlation_id or trace_id.
- Emit useful metrics for critical operations.

## Spec Kit workflow

For feature work, read in order:

1. `specs/{feature}/spec.md`
2. `specs/{feature}/plan.md`
3. `specs/{feature}/tasks.md`
4. `specs/{feature}/contracts/`

Do not implement before spec, plan and tasks exist.

## Read by task type

- Feature implementation: spec, plan, tasks, contracts.
- Refactor: this file, architecture doc, relevant tests.
- Contract change: OpenAPI/event schema, ADRs, impacted team docs.
- PR review: tasks, tests, contracts, DoD.

## Do not do

- Do not make unrelated refactors.
- Do not change generated contracts without owner review.
- Do not edit unrelated domains.
- Do not duplicate enterprise wiki content here.

## Deeper docs

- Architecture: `{architecture_doc}`
- ADRs: `{adr_folder}`
- Contracts: `{contracts_folder}`
- Domain context: `{domain_context_link}`
