# Plantilla — prompt @implement (spec-first)

Generable con: `./tools/kg-cli generate implement-prompt <SPEC-ID>`

```text
@implement {{SPEC_ID}}

Spec funcional:  specs/{{SPEC_FILE}}
Flujo:           {{FLUJO_NAME}} — spec {{SPEC_POS}} de {{SPEC_TOTAL}} según specs/README-{{FLUJO_NAME}}.md
Specs técnicas:  {{TECH_SPECS}}
Contratos:       {{CONTRACT_FILES}}
Figma:           {{FIGMA_URL}}
Repos:           {{REPOS}}

Bloqueado por:           {{DEPENDS_ON}}
Comparte entidades con:  {{SHARES_ENTITY}}
Comparte endpoint con:   {{SHARES_ENDPOINT}}

Reglas:
- Solo esta spec. Respetar lo ya mergeado.
- Leer primero specs/0000_SPEC_project_context.md del repo tocado y luego la spec técnica.
- UI web: convenciones del repo frontend + tokens desde MCP Figma (node-id obligatorio).
- Plan → "aprobado" (G1) → código → arnés (auto) → prereview → G2 → push.
- Todo cambio sustantivo actualiza la spec correspondiente y reindexa (kg-cli index specs).
- No marcar done sin prereview verde.
```
