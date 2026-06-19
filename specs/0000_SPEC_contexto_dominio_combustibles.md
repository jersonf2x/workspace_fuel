---
id: CTX-COMBUSTIBLES
title: Contexto de dominio combustibles — flujos B2C/B2B y relación con conductores
type: context
status: approved
jira: null
repos:
  - backend-product-fuel-policy-enforcer
  - backend-customer-account-drivers
  - frontend-micro-fuel
depends_on: []
flow_definitions:
  - key: b2c-supply-completed
    name: Flujo B2C — suministro ya completado
    summary: El usuario escanea el QR cuando el combustible ya fue despachado sin Flypass (hoseStatus SUPPLY_COMPLETED) y paga el valor exacto al final. FPE hace autorización completa (preautoriza y autoriza en un solo paso) vía POST /api/v1/full-fuel-authorizations (FullAuthorizeTransactionUseCase).
    states: CREATED -> PREAUTHORIZED -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
    entities: [fuelTransaction, fuelAuthorization, fuelDispenser, station]
    notes: El POS Distracom confirma por fallback con PUT /fuel-authorizations/confirm porque no hay preautorización pendiente sino autorización directa.
  - key: b2c-supply-in-progress
    name: Flujo B2C — suministro en proceso
    summary: El usuario escanea el QR mientras se despacha (hoseStatus SUPPLY_ON_PROGRESS). Como el valor final no se conoce, FPE preautoriza (POST /fuel-transactions, CreateFuelTransactionUseCase) y el POS confirma y autoriza el pago real al terminar (PUT /fuel-transactions/confirm y PUT /fuel-authorizations).
    states: CREATED -> PREAUTHORIZED -> PREAUTHORIZED_SENT_PROVIDER -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
    entities: [fuelTransaction, fuelAuthorization, fuelDispenser, station]
    notes: La preautorización con validación por saldo insuficiente es un resultado válido en este flujo (responde 200 OK y continúa). El flujo de configuración antes del despacho (IDLE) comparte la misma mecánica.
  - key: b2b
    name: Flujo B2B — política por placa
    summary: No inicia por QR de la app sino por el POS del proveedor (POST /fuel-authorizations, CreateFuelTransactionOnProcessUseCase). Está gobernado por una política de combustible (FuelPolicy) por placa, estación y cuenta/subcuenta, con autenticación PUSH_TOTP al conductor.
    states: ON_PROCESS -> PREAUTHORIZED -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
    entities: [fuelPolicy, plate, driver, fuelTransaction, attentionPoint]
    notes: Relación con conductores — la política está asociada a una placa, y la placa está asociada a un conductor (repo backend-customer-account-drivers, PlateOwnerClientPort). El código TOTP se envía al conductor.
---

# 0000_SPEC_contexto_dominio_combustibles

## Propósito

Contexto de dominio transversal del flujo de pago de combustible con Flypass para **alguien nuevo en el proyecto**. Define los **3 flujos de negocio** y cómo se relaciona el dominio de **conductores** con combustibles. El detalle técnico completo (endpoints, casos de uso, máquinas de estado) vive en `backend-product-fuel-policy-enforcer/specs/0000_SPEC_project_context.md` (FPE-0000).

Todo pago de combustible pasa por **FPE** (Fuel Policy Enforcer). El proveedor activo es Distracom; el POS del proveedor participa en la confirmación de todos los flujos.

## Los 3 flujos de combustibles

### 1. B2C — suministro ya completado (`b2c-supply-completed`)

El combustible **ya fue despachado** sin Flypass y el usuario paga al final. Estado del dispensador: `SUPPLY_COMPLETED`.

1. El usuario escanea el QR del dispensador en la app; la app consulta `GET /fuel-dispensers` (FPE → FDS → Distracom).
2. Como el valor exacto ya se conoce, la app llama `POST /api/v1/full-fuel-authorizations` (`FullAuthorizeTransactionUseCase`).
3. FPE crea la transacción, **preautoriza y autoriza en secuencia** con el mismo `paymentAuthorizationId` (ver FPE-0002). Saldo insuficiente aquí es error `400` (`TransactionBalanceException`).
4. FPE genera recibo (no rompe el flujo si falla) y el POS confirma por fallback: `PUT /fuel-transactions/:confirm` falla (no hay preautorización pendiente) → `PUT /fuel-authorizations/:confirm`.
5. Confirmado con el proveedor, FPE publica el evento de transacción confirmada a Kafka (outbox, FPE-0004).

```text
CREATED -> PREAUTHORIZED -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
```

### 2. B2C — suministro en proceso (`b2c-supply-in-progress`)

El usuario escanea el QR **mientras se despacha**. Estado: `SUPPLY_ON_PROGRESS`. El valor final no se conoce → **preautorización**.

1. La app crea la transacción con `POST /fuel-transactions` (`CreateFuelTransactionUseCase`); FPE preautoriza contra payment-authorizer (`JWT_APP`).
2. Saldo insuficiente **no** es error: queda `PREAUTHORIZED_WITH_VALIDATION`, responde `200 OK` y el flujo continúa.
3. Al terminar el suministro, el POS confirma la preautorización (`PUT /fuel-transactions/:confirm` → `PREAUTHORIZED_SENT_PROVIDER`) y autoriza el pago real con el monto final (`PUT /fuel-authorizations`, `AuthorizeTransactionPaymentUseCase`).
4. FPE ajusta `totalPrice`/`gallonsNumber`, genera recibo y publica el evento de confirmación a Kafka.

```text
CREATED -> PREAUTHORIZED -> PREAUTHORIZED_SENT_PROVIDER -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
```

> El flujo de configuración antes del despacho (`IDLE`) comparte esta misma mecánica; el usuario configura combustible/galones/tanque lleno antes de iniciar.

### 3. B2B — política por placa (`b2b`)

**No inicia por QR de la app**: lo inicia el **POS del proveedor** y lo gobierna una **política de combustible (`FuelPolicy`)** por placa, estación y cuenta/subcuenta. Se detecta B2B por presencia de `documentNumber`; la autenticación es `PUSH_TOTP`.

1. El POS solicita preautorización: `POST /fuel-authorizations` (`CreateFuelTransactionOnProcessUseCase`).
2. FPE **resuelve la cuenta/propietario por placa** (`PlateOwnerClientPort` → servicios de drivers/customer accounts).
3. FPE busca la política activa (`findApplicablePolicy(placa, attentionPointId, subAccountId)`) y valida restricciones: límites B2B globales, tope de galones y **límite diario por placa y política** (FPE-0007).
4. Payment-authorizer envía **código TOTP al conductor**; el POS aprueba con `POST /fuel-authorizations/:approve` (`ApproveFuelTransactionUseCase`).
5. Al completar el despacho, el POS autoriza el pago real (`PUT /fuel-authorizations`); en B2B el monto final no puede superar lo preautorizado.
6. FPE genera recibo y publica el evento de confirmación a Kafka.

```text
ON_PROCESS -> PREAUTHORIZED -> AUTHORIZED -> AUTHORIZED_PROVIDER_CONFIRMED
```

## Relación combustibles ↔ conductores

**En el flujo B2B la política está asociada a una placa, y una placa está asociada a un conductor.**

- La política (`FuelPolicy`) se define por **placa + estación + cuenta/subcuenta**.
- FPE resuelve el propietario/cuenta **por placa** consultando el dominio de conductores (`backend-customer-account-drivers`: `GET /api/v1/plates/{licensePlate}/drivers/validate`, `DriverController`, `DriverPlateController`).
- El código **TOTP de aprobación se envía al conductor** asociado a la placa.
- Los flujos B2C no dependen de conductores: el usuario se autentica con la app (`JWT_APP`).

## Cómo usar este contexto (agentes y humanos)

- Pregunta "¿cuáles son los flujos?" → `./tools/kg-cli query flows` (responde desde el grafo con esta definición).
- Cada spec de trabajo declara en su front-matter `flows:` a qué flujo(s) pertenece; el grafo agrupa y permite filtrar impacto por flujo.
- Detalle paso a paso completo: FPE-0000 (`backend-product-fuel-policy-enforcer/specs/0000_SPEC_project_context.md`).
