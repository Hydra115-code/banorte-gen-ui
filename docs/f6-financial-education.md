# F6 — Experiencia de educación financiera

Fecha de validación: 2026-09-12

## Resultado

F6 implementa y valida el recorrido educativo definido en el plan:

1. `Explícame por qué no logro ahorrar.` presenta primero una conclusión breve.
2. El diagnóstico usa métricas observadas y mantiene evidencia/periodo dentro de un acordeón expandible.
3. La simulación aparece sólo para apoyar la decisión y siempre muestra que no constituye una oferta financiera.
4. `No puedo reducir renta ni transporte.` conserva el diagnóstico y modifica únicamente recomendación y escenario mediante UI/Data Patches.
5. El slider previsualiza localmente la aportación y su resultado se reconcilia con patches correlacionados.
6. La recomendación termina con la acción concreta `Ajustar escenario`; no ejecuta pagos.

## Jerarquía visual

| Tipo | Patrón contractual |
| --- | --- |
| Datos observados | `section` primaria + badge informativo + métricas + evidencia expandible |
| Simulación | `section` secundaria + badge/alerta de advertencia + controles y proyección |
| Recomendación | `section` elevada + badge positivo + lista priorizada + siguiente acción |

Esta jerarquía usa componentes del contrato común; no introduce HTML, handlers o componentes arbitrarios provenientes del modelo.

## Continuidad

- los patches de la restricción sólo apuntan a `education-recommendation`, `education-simulation` y el slider;
- los datos observados y el diagnóstico no se reemplazan semánticamente;
- renta y transporte no se actualizan en el Data Registry;
- el cambio de slider avanza revisiones de UI y datos por separado;
- F4 deduplica el intent y acepta únicamente la respuesta correlacionada.

## Gates

- `pnpm education:verify`;
- `/dev/financial-education-harness`, recorrido visual por diagnóstico, restricción y reconciliación;
- gates acumulados F0–F5 y build de producción.

El harness responde 404 en producción y no requiere backend.

## Límite de integración

Los valores del harness son sintéticos. La personalización autoritativa y el E2E de la simulación requieren datos/eventos reales del backend. F6 no calcula ni presenta ofertas financieras oficiales y no ejecuta pagos.
