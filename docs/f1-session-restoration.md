# F1 — Restauración segura de sesión en frontend

Fecha de validación: 2026-09-11

## Resultado

La sesión activa y el historial de análisis pueden reconstruirse después de recargar la misma pestaña. La rehidratación reutiliza la transición `RESTORE_SESSION` de la máquina de estados y restablece de forma coordinada:

- `sessionId`;
- snapshot de UI y revisión;
- Data Registry y revisión;
- claves invalidadas;
- respuesta textual presentada;
- título e historial de hasta ocho análisis;
- estado visual `ready` cuando existía una sesión activa.

## Controles de seguridad

- Se utiliza `sessionStorage`; no se escriben datos financieros en `localStorage`.
- El archivo expira después de 30 minutos.
- El tamaño máximo serializado es 750 KB.
- Si el historial excede el límite, se conserva primero el análisis activo y se eliminan los más antiguos.
- Todo el contenido se revalida con UI DSL v1 y Data Registry antes de restaurarse.
- Un archivo alterado, vencido, sobredimensionado o con referencias inconsistentes se descarta.
- No se persisten `correlationId`, métricas, diagnósticos, estados pendientes ni eventos crudos del stream.
- La respuesta restaurada se reconstruye como un mensaje de presentación; no se reinyecta el historial crudo de AI SDK.

## Coherencia corregida

Los datos incluidos en eventos `ui` y `ui-started` ahora se incorporan al Data Registry antes de mostrar y persistir el snapshot. Esto evita que una vista muestre datos que no existen en su revisión restaurable.

## Límite de integración

Esta restauración es una caché efímera y validada del frontend. No declara que el snapshot sea autoritativo. Si el backend reinició o perdió su almacenamiento en memoria, una actualización posterior puede ser rechazada y deberá conservar el snapshot local.

La recuperación autoritativa requiere una ruta de backend por `sessionId` y queda explícitamente reservada para la fase de integración; no se simuló ni se modificó el backend.

## Gate

`pnpm session:verify` cubre restauración válida, expiración, manipulación, referencia activa inconsistente y recorte por tamaño.

En desarrollo, `/dev/session-restore-harness` permite sembrar y validar un snapshot contractual. Desde ahí se abre explícitamente el producto para comprobar la rehidratación y la recarga completa sin backend. La ruta responde 404 en producción.
