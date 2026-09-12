# F7 — Preparación segura de pagos

Estado: preparación frontend completa; ejecución pendiente de integración.

## Alcance implementado

- Captura de cuenta de origen, beneficiario, monto, concepto y fecha.
- Acción inequívoca `Revisar pago`, clasificada como intent de análisis: no ejecuta ni confirma.
- Revisión con cuenta enmascarada, beneficiario, monto, moneda, comisión, fecha y saldo estimado posterior.
- Acción explícita `Confirmar y pagar`, bloqueada por la política frontend mientras no exista un contrato autoritativo.
- Edición y cancelación limitadas al borrador o revisión; una cancelación genérica de pago sigue bloqueada.
- Protección sincrónica contra doble envío de la revisión.
- Error recuperable que conserva los valores revisados para corregirlos.
- Harness visual independiente del backend en `/dev/payment-safety-harness`.

## Lo que deliberadamente no se simula

El frontend no muestra pago exitoso, folio, referencia, comprobante ni movimiento nuevo. Tampoco cambia a ejecución ni reintenta una confirmación. Hacerlo sin respuesta contractual del backend produciría una afirmación financiera falsa.

## Contrato necesario para completar la integración

El contrato común debe definir, como mínimo:

1. creación y vigencia del intent de pago;
2. estado de autenticación antes de confirmar;
3. confirmación explícita ligada al intent;
4. clave de idempotencia y correlación;
5. estados autoritativos de ejecución;
6. errores recuperables/no recuperables;
7. resultado con referencia o comprobante verificable;
8. invalidación o actualización de movimientos y saldos.

Hasta que esas piezas existan tanto en frontend como en backend, F7 queda lista para integración, no marcada como ejecución completa.
