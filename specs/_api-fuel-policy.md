# Contrato API — product-fuel-policy-enforcer

> Repo: `backend-product-fuel-policy-enforcer`  
> Mantener sincronizado con OpenAPI del backend y mocks MSW del frontend.

## URLs por ambiente

| Ambiente | Base URL | Prefijo |
|----------|----------|---------|
| Cert | `https://cert-api.flypass.com.co` | `/product-fuel-policy-enforcer/api/v1` |
| Local (MSW) | _host dev_ | `/product-fuel-policy-enforcer/api/v1` |

Referencia mocks: `frontend-micro-fuel/apps/host/src/mocks/fuel-api.handlers.ts`

## Autenticación

- Bearer JWT vía interceptors del host MFE.
- Header de trazabilidad: `trace-Id` / `traceId` (validar convención del backend).

## Endpoints conocidos (desde mocks / frontend)

| Método | Path | Uso |
|--------|------|-----|
| `GET` | `/subaccounts/:subAccountId/onboardings` | Onboarding combustible |
| `GET` | `/vehicles` | Vehículos registrados para surtidor |
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
