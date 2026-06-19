# Prompt para generar CLAUDE.md por repositorio

Usa este prompt cuando se deba crear o actualizar `CLAUDE.md` en un repo F2X.

## Prompt

Genera un `CLAUDE.md` para el repositorio `{repo_name}` usando las fuentes disponibles:

- Arquitectura estrategica relacionada.
- Arquitectura de componente.
- Dominio y bounded context.
- Contratos API/eventos.
- Comandos reales de build, test y validacion.
- ADRs relevantes.
- Reglas de seguridad y observabilidad.

Restricciones:

- Maximo 200 lineas.
- No copiar documentacion enterprise completa.
- No copiar catalogos completos.
- No incluir secretos, tokens, passwords, usuarios reales o endpoints sensibles.
- Usar links a documentos profundos.
- Incluir solo contexto operativo util para el agente.
- Explicar que hace y que no hace el repo.
- Incluir boundaries de modulos o paquetes.
- Incluir comandos reales; si no existen, marcar como `{command_not_defined}` y pedir confirmacion.

Estructura requerida:

1. Mission
2. Ownership
3. Non-negotiable rules
4. Architecture
5. Inputs and outputs
6. External dependencies
7. Commands
8. Testing expectations
9. Security
10. Observability
11. Spec Kit workflow
12. Read by task type
13. Do not do
14. Deeper docs

Validacion final:

- Contar lineas.
- Verificar ausencia de secretos.
- Verificar que no duplica wiki.
- Verificar que los links apuntan a docs existentes o esperadas.
- Verificar que el agente puede saber que leer para feature, refactor, contrato y PR review.
