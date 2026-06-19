# Implementation Plan - {feature_name}

## Technical Context

- Repo: `{repo_name}`
- Bounded context: `{bounded_context}`
- Component: `{component_name}`
- Feature spec: `{spec_link}`
- Context pack: `{context_pack_link}`

## Constitution Check

| Rule | Result | Evidence |
|---|---|---|
| No secrets in context | {pass_fail} | {evidence} |
| Boundaries respected | {pass_fail} | {evidence} |
| Contracts identified | {pass_fail} | {evidence} |

## Scope

### In scope

- {in_scope}

### Out of scope

- {out_of_scope}

## Technical Design

### Components impacted

| Component/module | Change | Risk |
|---|---|---|
| {module} | {change} | {risk} |

### Data model

Reference: `data-model.md`

### Contracts

Reference: `contracts/`

### Observability

- Logs: {logging}
- Metrics: {metrics}
- Tracing: {tracing}

### Security

- AuthN/AuthZ: {security}
- Sensitive data: {sensitive_data_handling}

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| {risk} | {impact} | {mitigation} |

## Validation Strategy

- Unit tests: {unit_tests}
- Integration tests: {integration_tests}
- Contract tests: {contract_tests}
- Architecture tests: {architecture_tests}

## Context Budget

- Required context files: {files}
- Avoid loading: {avoid_files}
- Context pack size target: {target}

## Gate C3

Plan is ready when architecture boundaries, contracts, tests, security and observability are defined.

