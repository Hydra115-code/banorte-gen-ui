# L7 / I7 — Interacción de la UI con el Agent

Estado: implementado y validado; aceptación humana pendiente antes de I8.

## Flujo conservado

Control generado → UIEvent contractual → transporte AI SDK → `/api/agent`
con JWT en servidor → backend valida sesión, fuente, valor y revisiones → Agent
decide MCP → DataPatch / UIPatch → renderer actualiza la misma sesión.

El frontend no elige `toolName`, no contiene pantallas financieras prefabricadas
y no necesita enviar otro mensaje escrito para una interacción.

## Correcciones encontradas en la prueba real

1. El planner reinterpretaba el importe elegido y regeneraba el slider con otro
   valor. El backend ahora comunica que la selección es absoluta y reconcilia el
   control equivalente con el valor validado. Prioriza `sourceId`; sólo permite
   correspondencia por evento si existe un único candidato compatible, sin
   modificar otros controles que comparten evento.
2. Algunos importes de simulación llegaban como cadenas y las métricas numéricas
   mostraban `—`. El adaptador contractual normaliza esos campos monetarios a
   números, sin cambiar los resultados originales de MCP ni el contrato.

## Evidencia visual

Consulta: «Quiero ahorrar $50,000 en 8 meses. Muéstrame un control para ajustar
cuánto ahorro cada mes.»

En AppShell autenticado, el slider pasó de $6,250 a $15,000 y luego $14,500.
La última interacción, sin nuevo prompt, mantuvo $14,500 y mostró $116,000 en
8 meses con tasa cero. Backend ejecutó `simulate_savings` y emitió DataPatch y
UIPatch; misma sesión, revisión de UI 7 → 8. No hubo errores de consola.

Correlación final: `3cae91d2-b762-43b9-9580-468108d47b0e`.

La ronda completa tomó aproximadamente 9.1 s en backend; aplicar patches tuvo
p95 de 0.8 ms. La optimización de generación no se declara resuelta en I7.

## Validación

- Frontend: gate I7 (5 pruebas), gates de streaming, interacción y seguridad de pagos.
- Backend: suite completa 57/57; challenge 5/5; compilación aprobada.
- Frontend: compilación de producción aprobada.
- DateRange, Select, Slider y Button cubiertos en pruebas contractuales; Slider
  además comprobado visualmente con Agent y MCP reales.
- Valores inválidos, eventos fabricados, revisiones antiguas y controles que
  comparten evento cubiertos por regresión.

## Archivos backend modificados en I7

Ruta: `/home/erk/Documentos/Moc-back`.

- `src/integration/shared-ui-event.ts`: intención absoluta y reconciliación acotada.
- `src/integration/text-agent-service.ts`: usa reconciliación al adaptar la UI
  de interacciones para snapshots, patches y cierre.
- `src/integration/shared-contract-adapter.ts`: normalización monetaria de simulaciones.
- `tests/support/challenge-harness.ts`: eventos sin prompt y simulación determinista.
- `tests/i7-ui-interaction-loop.test.ts`: siete regresiones nuevas.
- `tests/challenge-e2e.test.ts`: espera el importe numérico del adaptador.

Frontend agrega gate y harness de desarrollo reutilizando AppShell. No se
modificaron contratos ni se habilitó ejecución de pagos desde controles: esa
validación pertenece a I11. Sin commits ni push; servicios de prueba detenidos.

Siguiente: I8 — sincronización y continuidad UI/datos, sólo tras aceptar I7.
