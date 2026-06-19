# Preset Nx + Angular — graph_module

Guía para monorepos **Nx** con microfrontends en `apps/` y librerías en `packages/`.

## Detección automática

Con `graph_module` instalado, `./tools/bootstrap-context --apply`:

1. Detecta `nx.json` + carpeta `apps/`.
2. Ajusta `graphify.config.json` si los roots sembrados no existen o son legacy (`frontend/MFE_*`).
3. Limpia `shellRoot` cuando no hay evidencia Flutter (`pubspec.yaml` / `melos.yaml`) en el repo.
4. Ejecuta `kg-cli index code` y valida que el grafo no quede vacío.

## Config esperada (Nx en raíz)

```json
{
  "frontend": {
    "mfeRoot": ".",
    "shellRoot": null,
    "mfeAppsDir": "apps",
    "shellFeaturesDir": null,
    "shellUiKitDir": null
  },
  "generic": {
    "frontendRoots": ["apps", "packages"],
    "companionRoots": ["scripts"]
  }
}
```

| Campo | Valor Nx | Motivo |
|---|---|---|
| `mfeRoot` | `"."` | El workspace Nx es la raíz del repo |
| `mfeAppsDir` | `"apps"` | Remotes + host viven bajo `apps/` |
| `shellRoot` | `null` | El shell Flutter suele estar en **otro repo** |
| `generic.frontendRoots` | `["apps","packages"]` | Libs compartidas (`bridge-adapter`, `commons`, …) |

## Layout legacy Flypass

Si el monorepo MFE vive bajo `frontend/MFE_<nombre>/apps/`, `bootstrap-context` detecta esa carpeta y conserva el layout legacy sin forzar el preset Nx.

## Componentes Angular flat

El `mfe-indexer` indexa componentes por:

- sufijo clásico `*.component.ts`, o
- presencia del decorador `@Component` en archivos `.ts` bajo `src/presentation/` (naming flat moderno).

## Validación

```bash
./tools/bootstrap-context --apply
./tools/kg-cli index code
bash kits/modular_dev_ai_kit/tools/validate-adoption.sh .
```

Si el grafo sigue vacío, `validate-adoption.sh` emite **WARN** con enlace a esta guía.

## Reproducción del hallazgo original

```bash
bash kits/modular_dev_ai_kit/tools/install.sh --target <repo-nx> --modules frontend,graph
cd <repo-nx>
./tools/bootstrap-context --apply
```

Tras el fix del kit, no deberían aparecer warnings de roots inexistentes ni grafo de código vacío en un monorepo Nx estándar.
