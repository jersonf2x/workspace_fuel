# Tasks - {feature_name}

## Rules

- Tasks must be atomic and verifiable.
- Tasks must reference spec, plan or contract.
- Parallel tasks must not edit the same critical files.
- Tests must be included before the feature is considered complete.

## Task list

### Setup

- [ ] T001 Read `spec.md`, `plan.md`, `CLAUDE.md` and feature context pack.
- [ ] T002 Confirm impacted files and modules.

### Tests first

- [ ] T003 Add or update unit tests for FR-001.
- [ ] T004 Add or update contract tests for changed API/event.
- [ ] T005 Add or update architecture tests when boundaries are affected.

### Implementation

- [ ] T006 Implement domain/application change for FR-001.
- [ ] T007 Implement interface or adapter change.
- [ ] T008 Update persistence or messaging adapter if required.

### Contracts and documentation

- [ ] T009 Update OpenAPI, event schema or integration contract.
- [ ] T010 Update ADR if a structural decision was made.
- [ ] T011 Update feature traceability.

### Validation

- [ ] T012 Run unit tests.
- [ ] T013 Run integration or contract tests when required.
- [ ] T014 Validate logs, traces and sensitive data handling.
- [ ] T015 Prepare PR summary with spec, plan, tests and risks.

## Parallelization notes

```yaml
parallelizable:
  - tasks: [T003, T004]
    condition: "Different test files"
  - tasks: [T006, T009]
    condition: "Contract is already agreed"
```

## Gate C4

Tasking is ready when every task has a clear outcome and validation path.

