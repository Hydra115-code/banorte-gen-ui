# C0 — Validación de la base integrada

Fecha: 2026-09-12. Estado: ABIERTA; no avanzar a C1.

## Alcance y evidencia de esta ejecución

- Frontend: `/home/erk/Documentos/Moc-Front-main`.
- Backend: `/home/erk/Documentos/Moc-back`.
- Ambos repositorios estaban limpios al iniciar.
- `pnpm typecheck` aprobado en ambos proyectos.
- Diez archivos de pruebas backend aprobados: payment-service,
  payment-session-and-ui, payment-write-tool-authorization,
  payment-confirmation-tool-authorization, payment-confirmation-policy,
  i11-form-submission, i11-ground-payment-options, i11-insufficient-funds,
  i8-session-snapshot y persistent-session-store.
- Cinco archivos de pruebas frontend aprobados: payment-preparation-safety,
  i11-form-submission, integration-snapshot-recovery, integration-patch-sync
  y patch-continuity-recovery.
- Estos resultados son pruebas automatizadas locales; no demuestran por sí
  solos transacciones ni concurrencia reales contra Supabase. Algunas
  comprobaciones existentes inspeccionan texto de código, no comportamiento.
- Frontend HTTP 200 en `http://localhost:3000/`.
- Backend `/api/system/status` respondió status ok y backend/agent/mcp ready.
  Fingerprint: `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.
- No se ejecutó build de producción en esta ejecución.

## Prueba visual nueva

Se observó primero el resultado histórico de una captura fallida de pago:
error semántico y tabla técnica de datos parciales. Es evidencia histórica,
no reproducción nueva del fallo del generador.

Se inició una consulta independiente en el harness:

> Quiero preparar un pago de $731 MXN a Servicios del Hogar desde Cuenta
> principal, concepto prueba C0. Muéstrame los campos editables con esos datos;
> no crees ni confirmes ninguna operación todavía.

Resultado: la UI mostró «Se perdió la conexión con el agente». Al recargar,
el harness mostró el formulario de inicio de sesión. La sesión autenticada
no estaba disponible para continuar. No se capturó el HTTP de esa solicitud,
por lo que no se atribuye su respuesta exacta a un 401 sin evidencia.

Hallazgo de código: `AgentSessionProvider.tsx` convierte cualquier `onError`
del transporte en `network_lost`; la ruta `/api/agent` puede devolver
`authentication_required` antes de iniciar el stream, y la presentación de
errores no contempla ese código. Se debe probar y corregir la clasificación
para no ofrecer un reintento de red cuando hace falta iniciar sesión.

No se pulsaron controles de revisión ni confirmación de pago; no se
ejecutaron seeds, migraciones, reinicios, commits ni push.

## Gate pendiente

| Caso | Estado requerido |
| --- | --- |
| Sesión ausente/expirada | Mensaje de autenticación correcto; sin reenvío financiero automático |
| Captura inequívoca | Origen, destinatario, monto y concepto precargados y editables |
| Captura ambigua/incompleta | Solicitar aclaración y bloquear revisión inválida |
| Revisión | Mostrar condiciones autoritativas; aún sin débito |
| Confirmación en demo verificada | Comprobante con folio y saldo final; un débito y un movimiento |
| Duplicado/concurrencia | Misma operación, sin segundo débito |
| Cambio posterior a revisión | Invalidar permisos anteriores y volver a revisar |
| Saldo insuficiente | Error específico y captura recuperable; sin débito |
| Cancelación y expiración | Estado terminal correcto y confirmación bloqueada |
| Fallo del generador/recarga | Recuperar estado autoritativo sin repetir la operación |

## Reanudación con sesión autenticada

El usuario volvió a iniciar sesión. Se repitió la consulta de $731 en una
sesión independiente: `3b10fdec-339b-42e7-b80a-8b520f268140`.

1. Captura: se generaron origen Cuenta principal, beneficiario Servicios del
   Hogar, monto 731, moneda MXN y concepto prueba C0, todos editables y
   precargados. Este caso de precarga visual pasa.
2. Campo vacío: se borró el monto y se pulsó Revisar pago. La interfaz entró
   en actualización, en vez de bloquear localmente el envío. Después mostró
   un error genérico de reconstrucción y conservó el formulario.
3. Corrección: se volvió a escribir 731 y se pulsó Revisar pago. Apareció
   «La interacción de interfaz no es válida». Posteriormente llegaron
   actualizaciones que mostraron una revisión de pago en UI revisión 11.
4. Estado final observado: coexistían «Necesita atención», el error anterior,
   el texto de captura que dice que no se creó operación y una tarjeta
   «Confirma tu pago» con botón Confirmar pago. No se atribuye qué envío
   originó la intención sin inspeccionar la traza completa del backend.

La revisión mostraba origen y beneficiario correctos, monto $731, concepto,
comisión $0, saldo estimado $21,265, expiración
`2026-09-12T22:51:00.253189+00:00` y estado `awaiting_confirmation`.
No se pulsó Confirmar pago ni se verificó el ledger mediante una reconsulta.
La existencia de la revisión no demuestra por sí sola que el saldo no cambió.

Hallazgos que bloquean C0:

- Monto obligatorio sin bloqueo local: el adaptador marca required en selects,
  pero no en los inputs de texto; el recolector permite un input vacío si
  su contrato no lo declara obligatorio. No hacer todos los campos obligatorios
  indiscriminadamente: concepto puede ser opcional.
- Recuperación/actualizaciones tardías: el resultado válido queda mezclado con
  un error anterior y una respuesta narrativa desactualizada. Investigar
  correlación, exclusión de envíos y limpieza de errores antes de confirmar.
- Presentación de revisión: fecha ISO y estado técnico sin traducción; moneda
  no aparece explícita como MXN en la tarjeta, solo el símbolo monetario.

La medición visible del último resultado indicó 9464 ms totales; es una muestra
individual, no un benchmark ni un percentil de latencia de generación.

C0 sigue abierta. No continuar a confirmación ni a C1 hasta resolver la
validación de captura y la coherencia del estado mostrado. Las pruebas de
cancelación, expiración, duplicados y recuperación integrada siguen pendientes.

## Corrección C0 — 2026-09-12 18:20 MDT

Se corrigieron tres causas observadas:

- El adaptador backend marca monto y moneda como requeridos cuando el submit
  corresponde a revisar o preparar un pago. Concepto permanece opcional.
- La validación frontend también reconoce esos roles en una UI de revisión y
  bloquea valores vacíos, incluso durante una transición gradual entre versiones.
- Un error local de formulario se muestra sin sacar la experiencia del estado
  listo; editar un campo elimina ese mensaje y permite volver a revisar.
- Una actualización puede recuperarse después de un error que conserva un
  snapshot. Al empezar una interacción se oculta la respuesta narrativa del
  turno anterior hasta recibir una respuesta nueva.
- Un HTTP 401 del transporte se presenta como sesión expirada y no como pérdida
  de red. Este comportamiento se comprobó en el harness después de reiniciar
  el backend.

Verificación posterior: backend build y suite completa 90/90; frontend build,
typecheck, máquina de estados, preparación de pagos, interacción, sincronización
y continuidad aprobados. `git diff --check` aprobado en ambos proyectos.

La sesión del navegador expiró durante la validación visual posterior. Falta
iniciar sesión y repetir monto vacío → corrección → revisión limpia antes de
declarar resuelto este bloque y continuar con la confirmación MOC.
