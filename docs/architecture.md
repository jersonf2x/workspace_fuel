# Component Architecture - {component_name}

Referencia estrategica: `{strategy_architecture_link}`

## Alcance

### Proposito del componente

Describir la responsabilidad funcional del componente o repositorio.

### Responsabilidades

- {responsibility}

### No responsabilidades

- {non_responsibility}

## Bounded context

- Contexto: `{bounded_context}`
- Owner tecnico: `{technical_lead}`
- Owner funcional: `{product_owner}`

## Estilos, patrones y tacticas

```yaml
quality_tactics:
  - quality_attribute: QA-001
    required_patterns:
      - {required_pattern}
    prohibited_patterns:
      - {prohibited_pattern}
    verification:
      - {verification_strategy}
```

## Stack tecnologico y dependencias

| Capa | Tecnologia | Version | Justificacion |
|---|---|---|---|
| Lenguaje | {language} | {version} | {reason} |
| Framework | {framework} | {version} | {reason} |
| Contratos | OpenAPI/Event schema | {version} | Fuente de verdad |

## Layout fisico del repositorio

```text
/{repo}
├── src/
├── test/
├── docs/
│   ├── architecture.md
│   └── adr/
├── specs/
└── CLAUDE.md
```

## Convenciones de paquetes o modulos

```text
{base_package}.domain.*
{base_package}.application.*
{base_package}.infrastructure.*
{base_package}.interfaces.*
```

## Fitness functions

1. Dominio no depende de framework, infraestructura ni interfaces.
2. Adaptadores de salida viven fuera de application.
3. Contratos REST tienen OpenAPI actualizado.
4. Eventos publicados tienen schema y owner.
5. Logs no exponen datos sensibles.
6. Operaciones criticas tienen trazabilidad.

## Vista de contenedores

```mermaid
C4Container
    title Container Diagram - {component_name}
```

## Vista de componentes

```mermaid
C4Component
    title Component Diagram - {container_name}
```

## Vista de despliegue logica

```mermaid
flowchart TB
    service[{component_name}]
    db[(Database)]
    broker[(Broker)]
    service --> db
    service --> broker
```

## Definition of Done

```yaml
dod:
  unit_tests_required: true
  integration_tests_required: true
  contract_tests_required: true
  architecture_tests_required: true
  observability_required: true
  security_scan_required: true
  documentation_updated: true
```

