# F1.1 — Auditoría de sesión y definición de estados

## Alcance

Este paso documenta el comportamiento actual y define la máquina de estados objetivo. No conecta todavía la máquina al runtime, no cambia la UI y no modifica el backend ni los contratos comunes.

## Flujo actual

1. `PromptComposer` valida el texto, actualiza Zustand y llama `sendPrompt`.
2. `AgentSessionProvider` usa `useChat` de AI SDK para enviar la solicitud a `/api/agent`.
3. El estado de red de AI SDK (`submitted` y `streaming`) se traduce manualmente a estados del workspace.
4. Los eventos del stream actualizan por separado la UI, el Data Registry, las revisiones y los diagnósticos.
5. Zustand conserva el estado visual global, mientras que la sesión, los snapshots y las revisiones viven en estado React y referencias en memoria.
6. Cancelar detiene el stream y conserva la última interfaz disponible.
7. El historial permite restaurar snapshots sólo mientras la pestaña siga viva.

## Hallazgos

| Área | Estado actual | Riesgo |
| --- | --- | --- |
| Estado de red | AI SDK expone `submitted/streaming`; el provider los traduce a `connecting/thinking` | La red y la experiencia financiera pueden divergir |
| Sesión | `sessionId` vive en una referencia React | Se pierde al recargar la página |
| UI generada | Se conserva mientras llegan parches | No existe una transición formal que garantice esa regla |
| Data Registry | Tiene revisión independiente y rechaza parches fuera de orden | Un conflicto termina actualmente en error genérico |
| Pagos | Sólo existe el estado genérico de interacción `pending/completed/failed` | No distingue confirmación, ejecución y resultado financiero |
| Historial | Snapshots en memoria dentro del provider | No sobrevive a una recarga |
| Zustand | Mezcla borrador, prompt y estado global | Todavía no está limitado explícitamente a caché visual |

## Decisión de diseño

La máquina objetivo usa once estados de experiencia:

`empty`, `submitting`, `retrieving_data`, `generating_ui`, `ready`, `updating`, `awaiting_confirmation`, `executing_action`, `partial`, `error` y `cancelled`.

Cada transición también proyecta cuatro dominios independientes:

- conversación;
- runtime de UI;
- Data Registry;
- pago.

La bandera `hasValidSnapshot` formaliza la regla más importante: una actualización, cancelación, respuesta parcial o recuperación nunca debe borrar la última UI confirmada.

## Límites para F1.2

La integración posterior deberá:

1. sustituir las asignaciones directas de `setStatus` por eventos de la máquina;
2. mantener el estado de red de AI SDK como señal de transporte, no como estado financiero;
3. adaptar los componentes existentes a los once estados;
4. persistir únicamente un identificador y snapshot seguro de sesión;
5. pedir al backend la recuperación cuando exista un conflicto de revisión;
6. agregar eventos contractuales de pagos sólo cuando el contrato compartido los soporte.

El punto 6 no puede resolverse unilateralmente desde el frontend.
