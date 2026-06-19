# Enterprise Constitution - AI Driven Development F2X

## Proposito

Definir reglas estables para construir software asistido por IA en F2X con arquitectura ejecutable, trazabilidad, seguridad y calidad.

## Principios no negociables

1. La wiki Flypass 2.0 es la fuente canonica de arquitectura, gobierno y lenguaje de dominio.
2. Toda iniciativa debe identificar dominio origen, dominios impactados y owners.
3. Toda feature asistida por IA debe tener `spec.md`, `plan.md` y `tasks.md` antes de implementacion.
4. Todo repo adoptado debe tener `CLAUDE.md` menor a 200 lineas.
5. Las decisiones estructurales se registran como ADR.
6. Los contratos REST se versionan como OpenAPI.
7. Los eventos se documentan en Event Catalog o schema versionado.
8. Ningun agente debe recibir secretos, credenciales o datos sensibles.
9. El contexto cargado debe ser el minimo necesario.
10. El codigo debe preservar boundaries de dominio, modulo y componente.

## Gobierno arquitectonico

- Arquitectura empresarial gobierna lineamientos transversales.
- Arquitectura de soluciones gobierna iniciativas y dependencias entre dominios.
- Lider tecnico gobierna arquitectura de componente y diseno detallado.
- Product Owner valida valor, alcance y acceptance criteria.
- QA valida comportamiento esperado y regresion.
- DevSecOps valida seguridad y cumplimiento operativo.

## Reglas de arquitectura

- No compartir bases de datos entre bounded contexts.
- No acceder directamente a persistencia de otro dominio.
- No introducir dependencias ciclicas.
- No publicar eventos sin contrato y owner.
- No modificar contratos cross-domain sin acuerdo con equipos impactados.
- No adoptar tecnologia nueva sin evaluacion y decision registrada.

## Reglas de IA

- Los agentes ejecutan dentro de contexto acotado.
- Los agentes deben declarar supuestos cuando falte informacion.
- Los agentes deben preferir cambios pequenos y revisables.
- Los agentes no deben hacer refactors no relacionados.
- Los agentes deben mantener documentacion, contratos y pruebas consistentes con el codigo.

## Reglas de validacion

Cada cambio debe validar, segun aplique:

- Pruebas unitarias.
- Pruebas de integracion.
- Pruebas de contrato.
- Pruebas de arquitectura.
- Revision de seguridad.
- Observabilidad minima.
- Trazabilidad hacia spec, plan y tasks.

## Excepciones

Una excepcion a esta constitucion requiere:

- Justificacion explicita.
- Owner responsable.
- Vigencia o condicion de cierre.
- ADR si afecta arquitectura, dominio, contrato o tecnologia.

