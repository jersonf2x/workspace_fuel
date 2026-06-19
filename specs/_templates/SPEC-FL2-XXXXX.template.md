---
id: SPEC-FL2-XXXXX
title: <título corto de la spec>
type: functional
status: draft # draft | approved | in_progress | implemented
jira: FL2-XXXXX # ticket/épico Jira, o null
repos: # repos hijos impactados
  - backend-product-fuel-policy-enforcer
  # - backend-customer-account-drivers
  # - frontend-micro-fuel
depends_on: [] # ids de otras specs que deben ir antes, ej. [SPEC-FL2-YYYYY]
flows: [] # flujo(s) de negocio: b2c-supply-completed | b2c-supply-in-progress | b2b (ver kg-cli query flows); [] = transversal
entities: [] # entidades de dominio, ej. [fuelTransaction, fuelAuthorization]
endpoints: [] # ej. ["PUT /fuel-transactions/:confirm"]
components: [] # componentes UI (solo si hay frontend), ej. [pp-button]
conditions: [] # reglas clave detectables, ej. [pagination, empty_state, dark_mode]
figma: # solo si hay UI; node-id obligatorio
  # - url: https://www.figma.com/design/<fileKey>/<name>?node-id=<id>&m=dev
  #   mode: light
---

# SPEC-FL2-XXXXX — <título>

## Propósito

<Qué problema de negocio resuelve y por qué. 2-4 frases.>

## Contexto

<Estado actual del sistema relevante para esta spec. Enlazar specs previas si aplica.>

## Comportamiento esperado

<Narrativa del comportamiento end-to-end, agnóstica de implementación.>

- 
- 

## Contratos

Ver [_api-fuel-policy.md](../_api-fuel-policy.md) / [_api-drivers.md](../_api-drivers.md) — sección "<operación>".

<Cambios de contrato que introduce esta spec, si los hay.>

## Reglas de negocio

- 

## Criterios de aceptación

- [ ] 
- [ ] 

## Specs técnicas derivadas

<!-- Una por repo impactado; se crean con specs/_templates/spec-tecnica.template.md -->

| Repo | Spec técnica | Estado |
|------|--------------|--------|
| backend-product-fuel-policy-enforcer | `specs/000X_SPEC_....md` | ⬜ |

## Out of scope

- 
