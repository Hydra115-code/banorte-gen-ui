# L10 / I10 — Cambio de vertical

Estado: L10 validada mediante recorrido integrado limpio. L11 pendiente,
no iniciada. Se conserva el pendiente exacto
de foco/scroll de L8, separado de este gate.

## Prueba real ejecutada

### Gate final aprobado — sesión autenticada renovada

Sesión `c168bcac-718c-48a6-befe-b4c506285898`, tres solicitudes consecutivas
sin reintentos ni peticiones correctivas, mismo resultado en historial:

1. Por qué no ahorro: revisión 3, agosto completo, métricas y diagnóstico
   OBSERVED, ajustes RECOMMENDED y limitaciones. Crédito excluido de liquidez.
2. No puedo reducir renta/transporte: revisión 15, vivienda $8,500 y transporte
   $2,400 protegidos; recomendaciones actualizadas en categorías flexibles.
3. Preparar $500 para tarjeta, sólo revisión: revisión 28. Se retiran regiones
   educativas que dejaron de ser útiles y se genera captura de origen,
   beneficiario/destino y concepto. La tarjeta no tiene beneficiario verificado;
   no se preselecciona un destino inventado. Mantiene categorías intocables sin
   sustituir sus cifras ni proyectar reducción de deuda/saldo de tarjeta.

Impacto marcado SIMULATED: margen de referencia $2,400 → $1,900 al asignar $500
desde ese margen. Alternativa de reasignación desde gastos flexibles expresada
condicionalmente, no como cambio bancario observado. DOM y captura visual
inspeccionados; controles de aclaración visibles. No se pulsó revisar/confirmar.

Traza final `23352fa6-6abb-4480-846e-ff6999a9eac3`: sólo `get_accounts`,
`get_beneficiaries`, `get_financial_summary` y `get_spending_by_category`.
Sin `create_payment_intent` ni `confirm_payment`. Trece patches secuenciales
15 → 28, UUID invariable. Contrato v1 / fingerprint `d4a19c24` invariable.

Regresión backend repetida: 78/78 aprobadas. Build aprobado en la entrega de
correcciones; este cierre sólo modifica documentación. `git diff --check` pasa.
Gate L10 aprobado: análisis → educación → captura de acción en la misma sesión.
No equivale a validar el pago accionable, idempotencia o confirmación de L11,
ni cierra el pendiente exacto de foco/scroll de L8. Sin commits ni push.

### Historial de pruebas previas (no aprobatorias)

Sesión `b815d311-0ddc-43b4-86c7-51302c6640e8`, mismo UUID al observar revisión
5 inicial y revisión 39 final; un único resultado en historial.

1. «¿Por qué no logro ahorrar?» con agosto completo y datos observados.
   La UI sólo mostró métricas de salud financiera: educación insuficiente.
2. Restricción: renta y transporte intocables y ajustes en categorías flexibles.
   Repitió métricas sin recomendaciones visibles; se corrigió su validación.
3. Repetición educativa: UI revisión 20 con OBSERVED y RECOMMENDED, tabla de
   categorías, vivienda $8,500 y transporte $2,400 protegidos, ocio/restaurantes
   como categorías flexibles y limitaciones explícitas.
4. «Usa $500 del margen para preparar un pago a mi tarjeta, sólo para revisión».
   UI revisión 26 se transformó en formulario de origen/destino/concepto.
   El destino no figura como beneficiario verificado. No se confirmó ni ejecutó.
   La narrativa cambió incorrectamente importes protegidos y asumió deuda.
5. Tras reforzar las reglas de generación, repetición correctiva: revisión 39
   con importes protegidos originales, margen $2,400 → $1,900 marcado SIMULATED,
   sin amortización no comprobada y destino pendiente de identificar.

La transición visual de educación a captura de pago funciona y no crea una
aplicación ni sesión nuevas. La API de la solicitud de preparación consultó
`get_accounts` y `get_beneficiaries`, sin `create_payment_intent` ni
`confirm_payment`. No se pulsó revisar ni confirmar.

## Cambios backend

- `semantic-ui-validator.ts`: para recomendaciones educativas solicitadas con
  evaluación de salud, exige explicación/recomendación visible o limitación de
  datos. Un respaldo de métricas no satisface ese requisito. Usa la última
  solicitud textual para no imponer educación a un seguimiento de pago.
- `ui-recovery-planner.ts`: reparación específica para educación incompleta.
- `ui-prompt.ts`: explicación educativa, fuentes vigentes para gastos protegidos,
  no asumir deuda desde saldo/límite de tarjeta y efectos de pago no ejecutado
  etiquetados como hipotéticos.
- `tests/i10-education-guidance.test.ts`: rechaza métricas sin explicación y evita
  heredar el requisito educativo a una solicitud de pago.

Sin cambios frontend, contratos, seeds, migraciones, commits ni push en esta
entrega. No se añadieron pantallas financieras prefabricadas.

## Verificación y pendiente

### Corrección adicional — 12 de septiembre

El validador ahora detecta patrones de narrativa de pago que calculan deuda
desde un saldo no acreditado, cifras de renta/transporte sin evidencia de su
categoría en `get_spending_by_category` y proyecciones de margen sin SIMULATED.
Son comprobaciones acotadas de texto, no una verificación exhaustiva del
lenguaje natural. La historia conversacional no acredita importes observados.
También exige explicación educativa cuando el usuario declara gastos intocables.

Backend: 78/78 pruebas aprobadas y build aprobado. Sin cambios de contratos.
Nueva ronda integrada en sesión `3915e108-099b-450e-95e1-cc72c9deab0e`:
primer diagnóstico aprobado y segundo turno aprobado en revisión 12,
con vivienda $8,500 / transporte $2,400 intocables y recomendaciones flexibles.
El tercer turno falló por schema. El reintento generó captura, pero todavía
afirmó que el saldo de tarjeta se reduciría; ese resultado NO aprobó el gate.
Se amplió el rechazo a esa afirmación, se especificaron las variantes de texto
permitidas y se aclaró que una cuenta de tarjeta no acredita un beneficiario.
`gemini-ui-generator.ts` registra tipo/códigos/rutas de rechazo, nunca el texto
generado, la consulta ni valores financieros. Regresión final: 78/78 y build.
Nueva ronda: sesión `6c6ca579-6a59-4a52-bdd7-762faba70c00`, primer diagnóstico
aprobado en revisión 2. El segundo mensaje fue rechazado por el frontend con
HTTP 401 antes de llegar al backend (terminal Next); la UI mostró incorrectamente
una pérdida de conexión genérica. No hubo nuevas llamadas MCP ni ejecución de
pago en ese segundo turno. Falta renovar la autenticación y repetir el gate
completo con las últimas correcciones. L10 permanece abierta; no pasar a L11.

- Backend 73/73 y build aprobados. Frontend educación 6/6 y pagos 6/6 aprobados.
- `git diff --check`: aprobado. Servicios activos.
- Pendiente histórico, resuelto por el gate final anterior: repetir una ronda limpia de tres mensajes con las correcciones ya
  cargadas, sin solicitudes correctivas adicionales, y verificar que no reaparezcan
  cifras protegidas distintas o deuda no comprobada. Las reglas de prompt no
  sustituyen una validación determinista de todos los importes en narrativa.
- El flujo accionable y confirmación de pago pertenecen a L11; no se validaron aquí.
