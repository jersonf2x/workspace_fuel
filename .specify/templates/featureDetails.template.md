# Feature Details - {feature_name}

Referencia componente: `{component_architecture_link}`

## Historia de usuario

```gherkin
Feature: {feature_name}

  Scenario: {happy_path}
    Given {initial_state}
    When {action}
    Then {expected_result}
```

## Modelo entidad relacion

```mermaid
erDiagram
    ENTITY {
      UUID id PK
      string name
    }
```

## Diagrama de secuencia

```mermaid
sequenceDiagram
    actor U as Usuario
    participant API as API
    participant UC as UseCase
    participant Repo as RepositoryPort
    U->>API: request
    API->>UC: command
    UC->>Repo: persist/query
    UC-->>API: response
    API-->>U: result
```

## Contratos de integracion

### APIs expuestas

```yaml
openapi: 3.1.0
paths: {}
```

### Eventos consumidos

```yaml
event_consumers:
  - id: EC-001
    topic: {context.entity.event.v1}
    owner: {producer_team}
```

### Eventos publicados

```yaml
event_publishers:
  - id: EP-001
    topic: {context.entity.event.v1}
    owner: {owning_team}
```

## Reglas de negocio

```yaml
business_rules:
  - id: BR-001
    description: "{business_rule}"
```

## Maquina de estados

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> COMPLETED
    COMPLETED --> [*]
```

## Casos de prueba

```yaml
unit_tests:
  - id: UT-001
    name: {test_name}
    expected_result: {expected_result}

integration_tests:
  - id: IT-001
    name: {test_name}
    expected_result: {expected_result}
```

## Trazabilidad

| Requisito | Contrato | Test | Task |
|---|---|---|---|
| FR-001 | {contract} | UT-001 | T001 |

