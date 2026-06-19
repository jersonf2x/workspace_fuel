---
id: <PREFIJO>-000X # FPE-000X | CAD-000X | MFE-000X según repo
title: <título corto>
type: technical
status: draft # draft | approved | in_progress | implemented
jira: null # hereda del refines si aplica
repo: <nombre-repo> # backend-product-fuel-policy-enforcer | backend-customer-account-drivers | frontend-micro-fuel
refines: [] # ids de specs funcionales del padre que detalla, ej. [SPEC-FL2-XXXXX]
depends_on: [] # ids de otras specs (técnicas o funcionales) que deben ir antes
flows: [] # flujo(s) de negocio: b2c-supply-completed | b2c-supply-in-progress | b2b (ver kg-cli query flows); [] = transversal
entities: []
endpoints: []
components: []
conditions: []
figma: []
---

# 000X_SPEC_<slug>

> Spec técnica de `<repo>`. Convención de archivo: `specs/000X_SPEC_<slug>.md` dentro del repo.
> Leer primero `specs/0000_SPEC_project_context.md` del repo y la spec funcional en el workspace padre.

## Propósito

<Qué se construye/cambia en ESTE repo y por qué.>

## Diseño

<Decisiones técnicas: módulos, capas hexagonales / providers MFE, tablas, eventos Kafka, adapters, etc.>

## Cambios

### Código

- 

### Persistencia / Liquibase (si aplica)

- 

### Contratos / eventos (si aplica)

- 

## Plan de pruebas

- 

## Riesgos y rollback

- 

## Criterios de aceptación técnicos

- [ ] 
- [ ] 
