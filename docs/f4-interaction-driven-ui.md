# F4 — UI dinámica provocada por interacción

Fecha de validación: 2026-09-12

## Resultado

El frontend coordina cada interacción generada antes de enviarla al agente:

- valida el evento local y el `UIEvent` contractual completo;
- registra de forma síncrona un único intent pendiente por `sourceId`, antes del siguiente render;
- bloquea dobles clics y emisiones repetidas mientras el nodo está pendiente;
- conserva `correlationId`, sesión, revisiones y valor al reintentar;
- sólo acepta una finalización cuyo `sourceId` y `correlationId` coinciden;
- ignora finalizaciones atrasadas que pertenecen a otra solicitud;
- mantiene la UI vigente y aplica la respuesta mediante el flujo de patches de F3.

## Política de eventos

| Clase | Ejemplo | Decisión del frontend |
| --- | --- | --- |
| Visual local | `ui.tab.changed`, `table.page.changed` | No sale hacia el agente |
| Simulación | `savings.monthly.changed` | Se envía como intent; la respuesta correlacionada reconcilia datos/UI |
| Análisis | `account.period.changed`, `payment.review.requested` | Se envía como intent sin ejecutar herramientas directamente |
| Acción financiera autoritativa | `payment.confirm.requested`, `transfer.execute_requested` | Se bloquea hasta que exista contrato backend de confirmación, idempotencia y ejecución |

La clasificación es una política de seguridad frontend. No modifica el contrato común ni inventa estados de éxito financiero.

## Reintentos

Cuando falla una interacción recuperable, “Reintentar” vuelve a enviar exactamente el último intent, incluido su `correlationId`. Un doble clic antes o durante ese envío no crea otra solicitud. Las acciones financieras autoritativas no entran a este flujo.

## Gates

- `pnpm interaction:verify`;
- `/dev/interaction-harness`, prueba visual automática de doble clic, estado pendiente, correlación, reintento y política;
- gates acumulados de F0–F3 y build de producción.

El harness responde 404 en producción y no requiere backend.

## Límite de integración

La respuesta real a simulaciones y análisis todavía requiere el E2E con backend. Los pagos continúan bloqueados: F4 no crea intents de pago, no confirma, no ejecuta y no fabrica comprobantes.
