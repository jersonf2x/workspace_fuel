# Contrato API — customer-account-drivers

> Repo: `backend-customer-account-drivers`  
> Mantener sincronizado con OpenAPI del backend y mocks MSW del frontend.

## URLs por ambiente

| Ambiente | Base URL | Prefijo |
|----------|----------|---------|
| Test | `https://test.security.flypass.co` | `/customer-account-drivers/api/v1` |
| Local (MSW) | _host dev_ | `/customer-account-drivers/api/v1` |

Referencia mocks: `frontend-micro-fuel/apps/host/src/mocks/driver-api.handlers.ts`

## Autenticación

- Bearer JWT vía interceptors del host MFE.
- Header de trazabilidad: `trace-Id` / `traceId`.

## Endpoints conocidos (desde mocks / frontend)

| Método | Path | Uso |
|--------|------|-----|
| `GET` | `/accounts/:accountId/drivers` | Lista conductores |
| `POST` | `/accounts/:accountId/drivers` | Crear conductor |
| `PUT` | `/accounts/:accountId/drivers/:driverId` | Actualizar conductor |
| _más_ | _documentar al sincronizar OpenAPI_ | |

## Errores

| HTTP | UI esperada |
|------|-------------|
| 400 | Mensaje de validación |
| 401 | Redirigir a login |
| 5xx | Empty state / retry |

## Pendientes

| Item | Estado | Ticket |
|------|--------|--------|
| Exportar OpenAPI oficial del backend | ⬜ | — |
| Completar tabla de endpoints | ⬜ | — |

## Changelog

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-06-10 | Versión inicial (workspace setup) | AI kit |
