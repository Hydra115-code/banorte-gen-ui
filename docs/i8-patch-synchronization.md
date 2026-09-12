# L8 / I8 — Sincronización de patches

Estado: **en curso; no autoriza pasar a L9**.

## Corrección de generación y borradores — 2026-09-12

- Reproducción real: la petición de una tabla de evolución exigía también una
  gráfica por la palabra «evolución». El validador ahora distingue tabla y gráfica
  explícitas; exige el control de aportación y el campo de notas solicitados.
  La frase genérica del UIEvent sobre preferencias no impone una gráfica.
- Backend: cambios en `semantic-ui-validator.ts`, `ui-recovery-planner.ts` y
  `ui-prompt.ts`; `shared-ui-event.ts` transmite identidad compacta de controles
  y conserva configuración/identidad de inputs locales inequívocos durante un
  cambio numérico; `text-agent-service.ts` usa el snapshot autoritativo previo.
  No se cambió el contrato compartido ni se incorporaron pantallas prefabricadas.
- Frontend: `interaction-policy.ts` mantiene `form.value.changed` local; submit
  sigue llegando al Agent y las acciones de pago siguen bloqueadas. `Input.tsx`
  y `UIEventProvider.tsx` conservan borradores por clave de compatibilidad aunque
  cambie el contenedor. El registro es sólo memoria, limitado a 128 entradas.
  `GenerativeCanvas.tsx` aísla el renderer por análisis y no etiqueta el fallback
  sin especificación como «Interfaz validada».
- Visual integrado: petición original de $40,000 / 10 meses / tasa cero generó
  slider, tabla y notas. Primero se detectó pérdida del borrador y se corrigió.
  Ronda final: $5,500 mensuales → $55,000 en el mes 10; las diez filas se
  actualizaron y «Reservar para útiles; conservar este borrador.» permaneció.
  Consola del recorrido sin errores. No demuestra guardado persistente de notas,
  foco/selección, scroll ni recuperación visual de conflicto.
- Backend: 67/67 pruebas y build aprobados. Frontend: build, typecheck,
  interacción (6), pagos (6), sincronización (4), snapshot (3) y continuidad (5)
  aprobados. La primera invocación frontend con `--import tsx` falló por no tener
  esa dependencia; el comando oficial `pnpm interaction:verify` pasó.
- Frontend y backend permanecen activos a petición del usuario. Sin commits ni push.

### Recorrido real de recuperación ejecutado

Se agregó un diagnóstico exclusivo de desarrollo y de esta ruta: repite la
última interacción de simulación, de la misma sesión y con revisión anterior,
mediante el transporte productivo. No cambia contratos ni modifica el backend.
El botón no está disponible en producción ni permite probar eventos financieros.

- Primera ronda detectó pérdida de nota al pasar a la vista degradada. Corregido:
  el registro de borradores vive por análisis fuera del renderer condicional y los
  providers anidados heredan ese registro.
- Segunda ronda: UI revisión 29, $4,700 / mes y $56,400 al mes 12.
  El envío anterior mostró el rechazo y «Sincronizar UI y datos»; mantuvo tabla,
  importe y «L8 recuperación: inscripción y útiles, conservar borrador.».
- Sincronización recuperó la vista vigente y eliminó el conflicto sin perder nota.
- Continuación real: $4,800 / mes, $57,600 al mes 12, UI revisión 34 y doce filas
  actualizadas; nota intacta. No se ejecutaron operaciones bancarias.
- Build, typecheck e interacción (7 pruebas) aprobados. Sincronización (4),
  snapshot (3) y continuidad (5) también pasaron en esta entrega.

El gate funcional de conflicto → recuperación → continuación pasó. L8 permanece
abierta para verificar continuidad exacta de scroll/foco: las capturas muestran
desplazamiento no nulo y cambios de distribución, pero no prueban igualdad de
posición antes/después. No se autoriza avanzar a L9 todavía.

## Validación real posterior a la migración

El usuario informó que aplicó la migración; se verificó funcionalmente contra
Supabase con usuarios demo autenticados mediante JWT individual renovado sólo
en memoria. No se cambió `.env`, no se aplicaron seeds ni se ejecutaron pagos.

- Sesión nueva: `557c3615-fe1c-4722-ab6e-a4c76f1a8669`, simulación de ahorro
  para gastos escolares ($4,250 mensuales, 9 meses, tasa cero).
- Snapshot real disponible en UI revisión 3 y datos revisión 2.
- Evento con revisión obsoleta rechazado con `session_revision_conflict`, sin
  DataPatch, UIPatch ni métricas de ejecución del Agent en esa respuesta.
- Recuperación posterior produjo el mismo contenido y hash SHA-256:
  `12250af892fe1d5ffe2e60dc2d725513ff3454d7cf0af4402d41556fb573ac46`.
- Endpoint frontend autenticado `/api/agent/snapshot` respondió 200 con el mismo
  snapshot; el restaurador frontend aceptó ambas revisiones y sus datos juntos.
- Usuario B recibió `session_not_found` y ningún snapshot del usuario A.
- Continuación por `/api/agent` frontend, con UIEvent válido y sin nuevo prompt,
  produjo tres DataPatch y tres UIPatch: UI 3 → 6, datos 2 → 5.
- Tras reiniciar la API, el snapshot final conservó revisiones 6/5 y el mismo hash
  antes/después: `c96d45e9c04b51cabb5c5e9daa7876d06318d52e39d0ef93bb3ab80a0b72847c`.
- Lectura de sesión ocupada respondió 409; el bloqueo de prueba fue liberado.
- Gate frontend L8 revalidado: 4 sincronización + 3 recuperación + 5 continuidad.

Pruebas diagnósticas temporales: `/tmp/banorte-l8-live-verification.mts` y
`/tmp/banorte-l8-read-persisted.mts`. No contienen credenciales literales ni las
imprimen; leen únicamente las credenciales demo existentes para autenticarse.
Las sesiones sintéticas creadas conservan la retención TTL normal del backend.

### Pendiente de cierre

La primera prueba visual generó $35,000 para $3,500 mensuales a 10 meses con
slider y notas. La siguiente interacción recibió 401 porque el JWT del
navegador expiró; **no se declara aprobada la continuidad visual de esa ronda**.
Se solicitó renovar la sesión en el harness visible de Codex. Falta comprobar
visualmente conflicto → botón de sincronización → recuperación → continuación,
incluyendo edición y desplazamiento no nulo. L8 permanece abierta.

La suite SQL con rollback sigue preparada, no ejecutada por este agente; los
resultados anteriores corresponden a RPC/HTTP reales, no a ese archivo SQL.

## Implementado y comprobado

- La ruta de streaming valida la revisión y operación de cada DataPatch antes
  de entregarlo al navegador, incluyendo las revisiones iniciales de follow-up
  y UIEvent. Rechaza duplicados, saltos y operaciones incompatibles.
- Verifica que los bindings de una UI tengan sus claves de datos disponibles
  antes de emitir el snapshot o UIPatch. Los bindings `$item` y `$index` son locales.
- Un conflicto UI/datos bloquea patches posteriores y solicitudes de la sesión
  afectada; no ofrece reintento ciego. La UI visible se conserva. Cambiar de
  análisis no desbloquea accidentalmente una sesión que ya tuvo conflicto.
- Se mantuvo el motor existente: actualización estructural acotada y referencias
  de ramas no modificadas, sin reconstruir toda la pantalla.
- Imports explícitos `.ts` en el registro permiten ejecutar las regresiones
  TypeScript directamente con Node; no cambia su comportamiento.

## Pruebas diferentes a L7

- `pnpm integration:patch-sync:verify`: typecheck, cuatro pruebas nuevas y cinco
  regresiones de continuidad aprobadas.
- `pnpm integration:streaming-ui:verify`: aprobado.
- `pnpm build`: producción aprobada.
- Backend: `tests/i8-patch-synchronization.test.ts`, un recorrido determinista
  completo con varios DataPatch/UIPatch y una solicitud obsoleta. Verifica
  revisiones entre turnos y que el rechazo no llama MCP ni modifica la sesión.
- Visual, `/dev/patch-continuity-harness`: nota «Comparar gastos escolares sin
  perder esta nota», pestaña Detalle y acordeón Evidencia abiertos. Cambiar sólo
  el título conservó foco, edición, selección, pestaña y acordeón. El harness
  reportó continuidad de scroll, pero la comprobación fue con desplazamiento
  cero: falta validar un desplazamiento no nulo en el recorrido integrado.
- Consola: sin errores. Esta prueba visual usa una fixture contractual para
  aislar reconciliación, no demuestra recuperación con backend/LLM reales.

## Segunda entrega: snapshot recovery implementado, validación DB pendiente

- Backend captura el DataRegistry real y sus invalidaciones durante cada turno.
  SessionStore en memoria conserva esos valores sin modificar contratos públicos.
- SupabaseSessionStore utiliza una RPC nueva de guardado atómico cuando dispone
  de todos los valores. Si la migración no existe, conserva la RPC anterior.
  No realiza fallback ante errores de permisos o de persistencia de la RPC nueva.
- Migración aditiva `20260912000300_agent_ui_snapshots.sql`: guarda datos,
  invalidaciones, revisiones y versión de sesión en la misma transacción que
  completa UI/contexto. La versión impide leer un snapshot anterior como vigente
  después de una escritura por la RPC legacy.
- Backend `/api/agent/snapshot`: lectura autenticada, limitada por los mismos
  controles HTTP y rate limits. No ejecuta Agent/MCP. Rechaza sesiones ocupadas,
  vencidas, ajenas o sin snapshot íntegro.
- Frontend `/api/agent/snapshot`: JWT HttpOnly enviado únicamente desde servidor;
  respuestas no cacheables, validación del DTO compuesto con los esquemas ya
  compartidos, identidad y timeout. No se modificó `@banorte/contracts`.
- Botón «Sincronizar UI y datos» en conflictos: valida ambos estados antes de
  restaurarlos juntos. Ignora respuestas tardías de otra sesión; un fallo mantiene
  la vista y el bloqueo. No reenvía la interacción ni permite reintento ciego.
- Pruebas frontend: 4 sincronización + 3 recuperación + 5 continuidad aprobadas;
  builds de frontend/backend aprobados. Backend: suite completa final 62/62
  aprobada, incluyendo autenticación HTTP de snapshots. Gates I6/I7 frontend
  revalidados después de los cambios.

### Archivos backend de esta segunda entrega

Todos bajo `/home/erk/Documentos/Moc-back`:

- `src/application/ports/session-store.ts` y `src/application/session-state.ts`:
  datos/invalidaciones opcionales internos y copia de estado.
- `src/integration/agent-session-store.ts`: snapshots en memoria con datos.
- `src/integration/text-agent-service.ts`: captura valores emitidos y persiste
  el registro en cierre normal y preservación parcial.
- `src/repositories/supabase-session.repository.ts`: RPC nueva con compatibilidad
  legacy y restauración al recuperar sesión.
- `src/integration/session-ui-snapshot.ts`: lectura/validación de snapshot.
- `src/http/system-api.ts`: endpoint autenticado de recuperación.
- `supabase/migrations/20260912000300_agent_ui_snapshots.sql`: aplicada por el usuario;
  persistencia y lectura verificadas contra Supabase real.
- `supabase/tests/ui_snapshot_recovery.sql`: prueba transaccional con rollback,
  **preparada pero no ejecutada**.
- `tests/i8-patch-synchronization.test.ts`, `tests/i8-session-snapshot.test.ts`,
  `tests/i8-snapshot-http.test.ts`: regresiones.

## Pendiente obligatorio: aplicar y validar persistencia real

Antes de aplicar la migración, la base backend persiste `specification`,
`interface_revision`, `data_revision` y `data_keys`, pero no los valores del
DataRegistry ni sus invalidaciones.
Restaurar únicamente UI/revisiones produciría bindings incompletos o datos viejos.
El archivo local del frontend tampoco es fuente autoritativa frente a un conflicto.

Para cerrar L8 hay que:

1. Aplicar la migración aditiva en **entorno de pruebas** después de las dos
   migraciones existentes. No aplicar seeds ni borrar datos para este paso.
2. Ejecutar `supabase/tests/ui_snapshot_recovery.sql` con los usuarios demo
   existentes. Su transacción termina con rollback; no conserva datos de prueba.
3. Crear una sesión nueva: las sesiones legacy sin todos sus valores no son
   recuperables y se rechazan de forma segura, no se reconstruyen con un LLM.
4. Inyectar un conflicto real, recuperar y continuar con ambas revisiones
   coincidentes. Probar timeout, sesión ajena y persistencia tras reinicio.
5. Repetir la prueba visual integrada con edición y scroll no nulo.

No se cambiaron contratos. La migración fue aplicada por el usuario, no por el
agente. No hubo commits/push.
No se levantaron servicios en la segunda entrega; las pruebas HTTP cerraron sus
puertos efímeros. Sin Supabase/psql CLI disponibles no se validó SQL real.
