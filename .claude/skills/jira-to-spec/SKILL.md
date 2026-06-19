---
name: jira-to-spec
description: >-
  Sincroniza issues de Jira (épico, stories, tasks) a specs funcionales en
  specs/ del workspace combustibles. Usa MCP Atlassian para leer tickets y
  genera specs/SPEC-FL2-*.md con front-matter YAML según la plantilla del kit.
  Usar cuando el usuario pida importar desde Jira, crear specs desde tickets,
  sincronizar backlog, o materializar FL2-* en specs/.
---

# Jira → Spec (workspace_fuel / combustibles)

Convierte tickets Jira en specs funcionales markdown indexables por `kg-cli`. **No implementa código** — solo materializa specs en `specs/`.

## Prerrequisitos

```bash
export KG_WORKSPACE_ROOT=/home/jerso/workspace_fuel
cd /home/jerso/workspace_fuel
```

| Recurso | Ruta |
|---------|------|
| Plantilla spec funcional | `specs/_templates/SPEC-FL2-XXXXX.template.md` |
| Plantilla spec técnica | `specs/_templates/spec-tecnica.template.md` |
| Índice flujo | `specs/README-combustibles.md` |
| Contratos | `specs/_api-fuel-policy.md`, `specs/_api-drivers.md` |

## Paso 0 — Resolver cloudId

1. Si el usuario da URL Atlassian (`*.atlassian.net`), usar el hostname como `cloudId`.
2. Si falla, llamar MCP `getAccessibleAtlassianResources` y tomar el `cloudId` del sitio Flypass.

## Paso 1 — Obtener issues de Jira

### Un ticket

```
getJiraIssue(
  cloudId: "<cloudId>",
  issueIdOrKey: "FL2-12345",
  responseContentFormat: "markdown"
)
```

### Épico completo (stories hijas)

```
searchJiraIssuesUsingJql(
  cloudId: "<cloudId>",
  jql: "parent = FL2-EPICO ORDER BY rank ASC",
  maxResults: 100,
  fields: ["summary", "description", "status", "issuetype", "priority", "parent", "issuelinks", "labels", "components"],
  responseContentFormat: "markdown"
)
```

Variantes útiles:

| Objetivo | JQL |
|----------|-----|
| Stories de un épico | `parent = FL2-XXXXX ORDER BY rank` |
| Un sprint | `sprint = 123 AND project = FL2 ORDER BY rank` |
| Label combustibles | `labels = combustibles AND type = Story ORDER BY created` |

Paginar con `nextPageToken` si hay más de 100 issues.

## Paso 2 — Mapear Jira → front-matter + cuerpo de la spec

| Campo spec | Fuente Jira |
|------------|-------------|
| `id:` | `SPEC-` + `key` (ej. `SPEC-FL2-12345`) |
| `title:` | `summary` |
| `type:` | `functional` |
| `status:` | `draft` |
| `jira:` | `key` |
| `repos:` | Inferir de labels/components/descripción (ver tabla abajo) |
| `depends_on:` | `issuelinks` tipo "is blocked by" → `SPEC-<key>`; si ninguno: `[]` |
| `flows:` | Inferir del contexto: `b2b` (política/placa/POS proveedor), `b2c-supply-completed` o `b2c-supply-in-progress` (QR app); `[]` si es transversal. Ver `kg-cli query flows` |
| `entities:` / `endpoints:` | Inferir de la description; dejar `[]` si no es claro |
| `figma:` | URLs `figma.com/design/...` con `node-id=` en description o comentarios |
| `## Propósito` / `## Comportamiento esperado` | `description` (narrativa; quitar AC si van aparte) |
| `## Criterios de aceptación` | Checklist en description (`- [ ]`, `* AC:`, sección "Criterios") |

### Inferencia de repos (combustibles)

| Señal en Jira | repos / contrato |
|---------------|------------------|
| conductor, driver, placa | `backend-customer-account-drivers` (+ `frontend-micro-fuel` si hay UI) + `_api-drivers.md` |
| política, policy, cupo | `backend-product-fuel-policy-enforcer` (+ frontend si hay UI) + `_api-fuel-policy.md` |
| transacción, surtidor, carga, QR | `backend-product-fuel-policy-enforcer` + `_api-fuel-policy.md` |
| Solo UI | `frontend-micro-fuel`; `figma:` obligatorio con node-id |

### Slug del archivo

```
specs/SPEC-FL2-12345-<slug>.md
```

- `<slug>` = summary en kebab-case, minúsculas, sin acentos, max 40 chars.
- Ejemplo: `SPEC-FL2-12345-lista-estaciones.md`

**No sobrescribir** una spec existente sin confirmación del usuario.

## Paso 3 — Generar cada spec

Usar `specs/_templates/SPEC-FL2-XXXXX.template.md` como base. Si faltan Figma URL, AC claros o endpoint: **crear la spec igual** con `status: draft` y marcar bloqueantes al final:

```markdown
## Bloqueantes (skill jira-to-spec)

- [ ] Figma node-id pendiente
- [ ] AC incompletos en Jira — revisar con PO
```

## Paso 4 — Actualizar índice del flujo

Editar `specs/README-combustibles.md`:

1. Tabla **Identificación** → `Épico Jira` con link al épico.
2. Tabla **Índice de specs funcionales** → una fila por spec (orden, ID, archivo, título, bloqueado por, estado ⬜).

## Paso 5 — Indexar grafo

```bash
cd /home/jerso/workspace_fuel
./tools/kg-cli index specs
./tools/kg-cli query flow-order
```

Reportar al usuario: cantidad de specs, orden DAG, warnings del indexer.

## Paso 6 — Informe de sincronización

```markdown
## Sync Jira → specs/

| Jira key | Archivo spec | Estado |
|----------|--------------|--------|
| FL2-12345 | specs/SPEC-FL2-12345-lista.md | creado |

- Épico: FL2-EPIC
- Specs indexadas: N
- Bloqueantes: <lista>
- Siguiente: `@implement flujo completo combustibles` (plan macro) o `@implement SPEC-FL2-12345`
```

## Modos de invocación

| Usuario dice | Acción |
|--------------|--------|
| "Importa el épico FL2-99999" | JQL `parent = FL2-99999` → todas las stories |
| "Crea spec de FL2-12345" | `getJiraIssue` → un archivo |
| "Sincroniza combustibles desde Jira" | Pedir épico o JQL si no lo dio |
| "Actualiza SPEC-FL2-12345 desde Jira" | Re-leer issue; merge conservando notas locales bajo `## Notas locales` |

## Errores comunes

| Problema | Acción |
|----------|--------|
| Auth MCP falla | Pedir al usuario verificar plugin Atlassian en Cursor |
| Issue sin description | Usar summary + comentarios vía `getJiraIssue` con expand |
| Key no es FL2-* | Igual crear con key real; el id queda `SPEC-<key>` |
| Spec ya existe | Mostrar diff propuesto; aplicar solo con OK del usuario |

## Referencias

- Flujo completo: `docs/ai-development-kit/workspace.md`
- Índice del dominio: `specs/README-combustibles.md`
