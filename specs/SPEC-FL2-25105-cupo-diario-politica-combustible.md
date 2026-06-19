---
id: SPEC-FL2-25105
title: Configuración de la Restricción de la Política de Combustible (cupo diario)
type: functional
status: implemented
jira: FL2-25105
repos:
  - backend-product-fuel-policy-enforcer
  - frontend-micro-fuel
  - testing-api-combustiblesB2B
depends_on: []
flows:
  - b2b
entities:
  - fuelPolicy
  - fuelTransaction
endpoints:
  - "POST /api/v1/accounts/{accountId}/subaccounts/{subAccountId}/fuel-policies"
  - "PUT /api/v1/accounts/{accountId}/subaccounts/{subAccountId}/fuel-policies/{id}"
  - "POST /fuel-transactions (preauth B2B)"
components:
  - create-policy-modal
  - policy-list
conditions:
  - full_tank_tooltip
  - cupo_diario_rolling_24h
  - cap_transaction_max
figma:
  - url: https://www.figma.com/design/8BIdGkjwyY2pQ7dBLwZERF/%F0%9F%9F%A0-%7C-%F0%9F%9B%A2-Estaciones-de-servicio?node-id=10174-62543&t=VEEvRe9Ugy9rT5Dv-0
    mode: dev
---

# SPEC-FL2-25105 — Configuración de la Restricción de la Política de Combustible

## Propósito

Simplificar la configuración de políticas B2B eliminando el campo separado `dailyRestriction` y reutilizando el valor ya configurado en la política (`maxQuantity` + `supplyType`) como el tope diario del conductor. Adicionalmente, cambiar la ventana de control de 24 horas por ventana calendario UTC a una ventana **rolling de 24 horas desde la primera transacción**, y hacer que el surtidor sea programado por el valor **restante** disponible (no siempre por el máximo).

## Contexto

FPE-0007 ya cambió la semántica de `dailyRestriction` de "cantidad de transacciones" a "monto COP por placa/día" y lo hizo nullable. FL2-25105 va un paso más allá: **elimina el campo `dailyRestriction` por completo** (de la UI, del API y de la BD), y traslada el control del cupo diario al propio `maxQuantity` de la política. El tiempo de referencia pasa de día calendario UTC a rolling de 24h desde la primera transacción confirmada.

Referencia Figma (diseño aprobado): [Estaciones de servicio — node 10174-62543](https://www.figma.com/design/8BIdGkjwyY2pQ7dBLwZERF/%F0%9F%9F%A0-%7C-%F0%9F%9B%A2-Estaciones-de-servicio?node-id=10174-62543&t=VEEvRe9Ugy9rT5Dv-0).

> **Bloqueante parcial**: el Figma no incluye el mensaje de tooltip para el caso Tanque Lleno — el texto está definido por negocio en este spec y debe implementarse sin diseño visual adicional.

## Comportamiento esperado

### Política (creación y edición)

- El campo **Restricción** (`dailyRestriction`) se elimina de la interfaz de creación y edición de política.
- El campo no se envía en los requests `POST` / `PUT` de política; el backend lo ignora en caso de que llegue y no lo persiste.
- En el formulario, cuando el usuario selecciona **Tanque Lleno**, debe aparecer un **tooltip** junto al switch indicando:
  > "Esta opción permite un solo suministro de tanque lleno por día"
- El tooltip aplica tanto en el modal de creación como en el de edición.

### Preautorización B2B (transacción)

La lógica de programación del surtidor cambia:

1. **Ventana de 24 horas rolling**: se calcula desde el `created_at` de la primera transacción **confirmada** (`AUTHORIZED_PROVIDER_CONFIRMED`) de la placa bajo esa política en las últimas 24 horas. Si no existe, no hay restricción acumulada.

2. **Cálculo del valor a retornar**:
   - `consumido = SUM(total_price o gallons_number)` de transacciones confirmadas en la ventana de 24h.
   - `disponible = policy.maxQuantity − consumido`.
   - `retornado = min(disponible, límite_máximo_por_transacción)`.
     - Para galones: `límite = transaction_b2b_maximum_gallons`.
     - Para monto: `límite = transaction_b2b_maximum_amount`.

3. **Tanque lleno**: si ya existe una transacción confirmada de tanque lleno para esa placa y política en las últimas 24h → rechazar con error.

4. **Validaciones de error**:
   - Si `disponible ≤ 0` (galones): lanzar `"El conductor superó el monto máximo permitido de Galones por día"`.
   - Si `disponible ≤ 0` (precio): lanzar `"El conductor superó el monto máximo permitido de Precio por día"`.
   - Si tanque lleno ya usado: lanzar con el mismo mensaje.
   - HTTP 422 Unprocessable Entity en todos los casos.

## Contratos

Ver [_api-fuel-policy.md](../_api-fuel-policy.md).

**Cambios de contrato que introduce esta spec:**

| Elemento | Antes | Después |
|---|---|---|
| `CreateFuelPolicyRequest.dailyRestriction` | campo requerido `Long` | **eliminado** |
| `UpdateFuelPolicyRequest.dailyRestriction` | campo requerido `Long` | **eliminado** |
| `FuelPolicyResponse.dailyRestriction` | presente | **eliminado** |
| `FuelPolicyDetailResponse.dailyRestriction` | presente | **eliminado** |
| `fuel_policy.daily_restriction` (BD) | columna BIGINT nullable | **columna eliminada** |
| Preauth B2B — valor retornado | `policy.maxQuantity` completo | `min(maxQuantity − consumido24h, txMaxCap)` |

## Reglas de negocio

- El `maxQuantity` de la política es el tope diario del conductor (en galones o COP según `supplyType`).
- La ventana temporal es **rolling de 24h** desde `created_at` de la primera transacción confirmada (no día calendario UTC).
- Solo transacciones con estado `AUTHORIZED_PROVIDER_CONFIRMED` consumen cupo.
- Transacciones en preautorización, fallidas o revertidas **no** consumen cupo.
- Tanque lleno: límite de 1 transacción confirmada por placa por política en ventana 24h.
- El valor programado en el surtidor nunca supera los límites globales de transacción (`transaction_b2b_maximum_amount`, `transaction_b2b_maximum_gallons`).
- Si hay cupo disponible pero es menor al mínimo de transacción (`transaction_b2b_minimum_amount`), el comportamiento queda pendiente de decisión de negocio (bloqueante menor; dejar igual que hoy: si `disponible > 0` procede).

## Criterios de aceptación

- [ ] El campo Restricción desaparece del formulario de creación de política en el frontend.
- [ ] El campo Restricción desaparece del formulario de edición de política en el frontend.
- [ ] Al seleccionar "Tanque Lleno" en el formulario, aparece tooltip con texto "Esta opción permite un solo suministro de tanque lleno por día".
- [ ] El request POST y PUT de política no incluye `dailyRestriction`; el backend no lo persiste ni lo devuelve.
- [ ] La columna `daily_restriction` es eliminada de la tabla `fuel_policy` (migración Liquibase).
- [ ] Una placa puede crear múltiples transacciones B2B en 24h mientras no supere `policy.maxQuantity` acumulado.
- [ ] La preautorización retorna `min(maxQuantity − consumido24h, txMaxCap)` como valor a surtir.
- [ ] Al superar `maxQuantity` en galones, la preautorización retorna 422 con mensaje "El conductor superó el monto máximo permitido de Galones por día".
- [ ] Al superar `maxQuantity` en precio, la preautorización retorna 422 con mensaje "El conductor superó el monto máximo permitido de Precio por día".
- [ ] Al intentar una segunda transacción de tanque lleno en 24h, la preautorización retorna 422.
- [ ] Los tests de Karate (Policies CRUD, autorizaciones E2E) pasan sin `dailyRestriction` en los payloads.

## Specs técnicas derivadas

| Repo | Spec técnica | Estado |
|------|--------------|--------|
| backend-product-fuel-policy-enforcer | `specs/0008_SPEC_FL2_25105_cupo_diario.md` | ⬜ |
| frontend-micro-fuel | `specs/0001_SPEC_FL2_25105_politica_ui.md` | ⬜ |
| testing-api-combustiblesB2B | `specs/0001_SPEC_FL2_25105_tests.md` | ⬜ |

## Out of scope

- Cambio de ventana temporal en transacciones B2C.
- Notificaciones al conductor cuando se acerca al límite.
- Dashboard de consumo diario por placa.
- Configuración de ventana diferente por política.
