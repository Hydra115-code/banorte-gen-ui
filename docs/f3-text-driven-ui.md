# F3 — UI dinámica provocada por texto

Fecha de validación: 2026-09-12

## Resultado

Las consultas posteriores continúan enviándose únicamente al confirmar el texto e incluyen `sessionId`, revisión de UI, revisión de datos y claves disponibles. Mientras llega la respuesta, el último snapshot válido permanece visible.

F3 añade continuidad y explicación sobre ese flujo existente:

- cada UI Patch produce una descripción breve basada en la operación y el nodo afectado;
- los Data Patches se resumen sin mostrar valores financieros;
- una actualización que sólo modifica datos consolida su resumen al recibir el estado `ready`;
- un reemplazo completo se compara por IDs estables y reporta elementos agregados, actualizados y eliminados;
- el resumen deduplica mensajes y muestra hasta cinco cambios;
- el bloque “Qué cambió” usa `aria-live="polite"` y queda asociado a la revisión aplicada;
- el resumen se conserva al navegar por el historial y al recargar la pestaña.

## Continuidad de controles

Antes de aplicar una nueva especificación o patch, el frontend captura el control enfocado y su selección de texto. Después del commit:

1. si el mismo control continúa montado, React conserva valor y foco;
2. si fue reemplazado pero conserva el ID, se recuperan foco y selección sin mover el scroll;
3. si el control ya no existe, no se fuerza foco hacia otro elemento;
4. si cambian límites, opciones, validación o valor inicial, el control se remonta con el nuevo contrato;
5. cambios cosméticos de etiqueta, ayuda o evento no reinician su estado local.

La conservación de scroll existente permanece condicionada a que la persona estuviera cerca del final del canvas.

## Escenarios cubiertos

- refinamiento pequeño mediante patches sucesivos;
- actualización vinculada exclusivamente a datos;
- cambio completo de presentación;
- cambio entre banca personal y educación financiera;
- conservación de valor/foco ante un patch compatible;
- reconciliación de valor/foco ante un cambio contractual incompatible;
- persistencia de la explicación en historial y recarga.

## Gates

- `pnpm dynamic-ui:verify`
- `/dev/dynamic-ui-harness` para la prueba visual automática de foco y reconciliación;
- `/dev/session-restore-harness` para revisar el bloque “Qué cambió” dentro del producto.

Los harness responden 404 en producción y no requieren backend.

## Límite de integración

El E2E que parte de texto libre y valida la respuesta real del agente requiere conectar el backend. F3 valida todo el recorrido controlado por el frontend con eventos y fixtures contractuales, sin inventar respuestas del servidor.
