---
id: SPEC-FL2-24307
title: Configuración por ambiente y autenticación dual en creación de punto de atención
type: functional
status: approved
jira: FL2-24307
repos:
  - backend-product-fuel-policy-enforcer
depends_on: []
entities:
  - attentionPoint
endpoints: []
components: []
conditions: []
figma: []
---

# SPEC-FL2-24307 — Configuración por ambiente y autenticación dual en creación de punto de atención

> Spec funcional de ejemplo del flujo spec-first. Derivada del trabajo real entregado en `backend-product-fuel-policy-enforcer/specs/0003_spec_FL2_24307.md` (FPE-0003, `refines` → esta spec).

## Propósito

Permitir que la operación configure los límites de pago y vigencia de los puntos de atención por ambiente sin recompilar, y habilitar autenticación B2C y B2B en los puntos de atención registrados ante payment-authorizer.

## Comportamiento esperado

- Los defaults del punto de atención (`maximum-payment`, `minimum-payment`, `validity-hours`) se leen de configuración externa por ambiente (AWS Parameter Store), no de valores fijos compilados.
- Al registrar un punto de atención, payment-authorizer recibe `paymentAuthenticationType = JWT_APP|PUSH_TOTP`, habilitando ambas modalidades (B2C y B2B).

## Criterios de aceptación

- [x] Cambiar un default de punto de atención en un ambiente no requiere recompilación ni redeploy de código.
- [x] Un punto de atención nuevo acepta autenticación JWT_APP y PUSH_TOTP.

## Specs técnicas derivadas

| Repo | Spec técnica | Estado |
|------|--------------|--------|
| backend-product-fuel-policy-enforcer | `specs/0003_spec_FL2_24307.md` (FPE-0003) | ✅ |

## Out of scope

- Cambios en frontend o en el backend de conductores.
