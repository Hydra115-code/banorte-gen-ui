# L11 / I11 — Flujo accionable de pago

Estado: en curso. Primera corrección de captura validada; gate completo no
aprobado. No avanzar a L12 ni declarar pago integrado terminado.

## Primera prueba, distinta de L10

Petición de preparar $500 MXN a Arturo, mostrar coincidencias y cuentas sin
elegir automáticamente ni ejecutar. El backend no estaba activo; se restauró
el servicio 3101 y se repitió la solicitud.

Sesión `529ea4d2-2020-40b7-9f5d-690b7e5a9e56`: revisión 3 de captura y revisión
9 después de pulsar Revisar pago sin elegir origen ni destinatario. Arturo no
existe en los datos activos. Se muestran Ahorro Familiar y Servicios del Hogar
como alternativas, sin asumir que alguno sea Arturo. No se eligió ninguno.

Problema: los select sin placeholder mostraban la primera opción aunque su
estado interno era vacío. Se corrigió el renderer genérico para mostrar siempre
una opción vacía. Se comprobó mediante DOM y captura visual que ambos controles
ahora muestran «Selecciona una opción». El adaptador backend marca los select
de formulario como requeridos, sin valor inicial. No hay pantalla de pago
prefabricada ni cambios en los contratos compartidos.

Prueba negativa: Revisar pago sin seleccionar sólo consultó get_accounts y
get_beneficiaries; no creó intent ni ejecutó pago. Traza
`9a6a4501-f7f7-49a8-986b-68cbbb6aaeb3`, evento form.submit, UUID conservado.
Esta prueba no demuestra validación local completa: el botón todavía puede
salir aunque falten campos y el backend vuelve a pedir aclaración.

## Cambios de esta entrega

- Frontend: `src/features/generative-ui/interactions/components/Select.tsx`,
  opción vacía explícita también cuando el contrato no trae placeholder.
- Backend: `src/integration/shared-contract-adapter.ts`, selección explícita
  requerida en select de formulario, usando propiedades ya contractuales.
- Backend: `tests/payment-session-and-ui.test.ts`, regresión de captura sin
  selección inicial y con required/placeholder.

Backend: 79/79 pruebas y build aprobados. Frontend: pagos 6/6 y typecheck
aprobados. git diff --check aprobado. Servicios activos con el código recargado.
Sin commits/push, seeds, migraciones ni movimientos de saldo en esta entrega.

## Próximas correcciones, en orden

### Ampliación autorizada del contrato — captura completa

El usuario autorizó ampliar UIEvent y sincronizar la fuente compartida.
`event.formValues` es un registro tipado de 1–12 ids de campo con strings de
hasta 500 caracteres, exclusivo de form.submit. No cambia el formato de los
eventos anteriores. Ambos protocol.ts tienen el mismo hash y fingerprint
contractual `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.

AgentSessionProvider guarda edición local acotada en memoria y recoge sólo
campos del formulario pulsado, usando initialValue contractual cuando no hubo
edición. Bloquea selecciones vacías/inválidas antes de enviar. Backend vuelve
a validar pertenencia, completitud, opciones y límites contra su UI autoritativa
y proporciona al agente campos con sus etiquetas. No concede todavía permisos
de pago a ese evento; esa es la siguiente corrección.

Precarga: un valor inicial debe proceder de una elección inequívoca del usuario
y datos verificados; nunca equivale a confirmar. El recolector conserva valores
iniciales del contrato, pero aún falta validar la precarga en generación real
(el DSL privado de campos todavía no expresa initialValue).

Verificación: backend 81/81, build y typecheck; frontend typecheck, dos pruebas
de captura y roundtrip contractual aprobados. Visual: Revisar vacío queda
bloqueado con mensaje de campos faltantes y UI revisión 9 conservada, sin
enviar una nueva revisión al backend. No se ejecutó pago ni se hizo commit/push.

Cambios adicionales: protocol.ts en la fuente backend y réplica sincronizada
frontend; backend shared-ui-event.ts y tests/i11-form-submission.test.ts;
frontend AgentSessionProvider.tsx, interactions/form-submission.ts y
scripts/i11-form-submission.test.ts. Fingerprints regenerados por el script
oficial de contracts. L11 continúa abierta.

1. Conectar valores de captura al agente y bloquear revisión incompleta.
   Brecha inicial resuelta por la ampliación anterior: form.value.changed era local y no conservaba valores para el envío;
   Button emite undefined y form.submit no incluye campos. No ocultar un nuevo
   contrato de formulario mediante JSON arbitrario dentro de event.value.
   El contrato existente admite eventos individuales de controles: verificar
   una solución con acumulación validada server-side y sus revisiones antes de
   conceder permiso de crear intención. Si exige ampliar contrato, actualizar
   la fuente única y ambos consumidores de manera explícita, no duplicarlo.
2. Autorizar sólo creación de intención desde una revisión validada: actualmente
   text-agent-service concede paymentWriteGrant en queries, no en form.submit.
   Un campo editado o botón genérico no debe obtener permiso financiero por sí solo.
3. Verificar review completo (origen/destino/monto/moneda/comisión/expiración/saldo
   estimado), sin tocar saldo ni fabricar comprobante.
4. Ejecutar confirmación explícita en demo y comprobar comprobante autoritativo,
   saldo y movimientos reconsultados por MCP. El código RPC inspeccionado es
   un ledger MOC de Supabase; comprobar identidad sintética y entorno activo
   antes de confirmar. No asumir que cualquier base remota sea descartable.
5. Probar doble clic, evento obsoleto, mismo intent confirmado repetidamente,
   fondos insuficientes y cambios entre revisión y confirmación. Cada caso con
   datos/pregunta distintos, sin reset destructivo de la base.

Gate final: acción UI → agente → MCP → transacción → comprobante y datos nuevos,
un solo débito/movimiento aun con duplicados. Todavía NO aprobado.
