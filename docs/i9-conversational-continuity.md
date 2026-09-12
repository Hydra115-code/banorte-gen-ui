# L9 / I9 — Continuidad conversacional

Estado: validada en el alcance de continuidad conversacional. Se inicia por indicación explícita del usuario, conservando
el pendiente de foco/scroll exactos de L8; L8 no está aprobada al 100%.

## Recorrido integrado ejecutado

1. «¿En qué estoy gastando más este mes?» con movimientos reales, evidencia,
   exclusión de crédito y separación de transferencias internas. UI revisión 4.
2. «Ahora sólo usa mi cuenta principal», conservando periodo y exclusiones y
   aclarando transferencias sin destino conocido. UI revisión 7.
3. «Compáralo con el mes pasado y quita todas las tablas». UI revisión 10:
   conservó una tabla, por lo que esta ronda no aprobó el gate.
4. Tras corregir el validador, se repitió la tercera solicitud: UI revisión 13,
   sin tablas, saldo principal $22,499, ahorro/crédito excluidos, septiembre
   parcial vs agosto completo y sin porcentajes inventados.

El historial mostró un único resultado durante los cuatro mensajes. La UI
vigente permaneció visible mientras se procesaban los seguimientos. El código
existente envía sessionId y revisiones actuales sin limpiar el canvas; esto no
sustituye una comprobación del UUID de extremo a extremo.

## Cambio realizado

Backend `src/ui/generation/semantic-ui-validator.ts`: reconoce solicitudes
imperativas de quitar/eliminar/retirar/suprimir tablas, gráficas o dashboards.
Regresión en `tests/i8-savings-ui-semantics.test.ts`: variantes de eliminación
de tabla y «No quites la tabla». Regresión y build backend aprobados.
Sin cambios de contratos, seeds, pagos, commits ni push. Backend y frontend
activos para continuar las pruebas.

## Ronda final después de la corrección

- Sesión visible: `fb42880e-0e68-4195-95a5-e3f3c7107538`, igual al observar
  segundo y tercer resultado. El primer mensaje inicializa la sesión; los
  siguientes reutilizan la referencia en el transporte existente. Backend
  confirmó inicio 0/0 y continuaciones desde UI 5/datos 5 y UI 14/datos 12.
  La regresión determinista comprueba el UUID exacto en tres turnos. El logger
  mantiene sessionId redactado, sin JWT ni credenciales.
- Tres mensajes reales: gastos del mes → sólo cuenta principal → comparación
  con agosto sin tablas. Revisiones UI 5 → 14 → 21, un resultado en historial,
  vista anterior conservada durante streaming, exclusiones de ahorro/crédito
  y periodos presentes en la UI final.
- Raíz `root-dashboard` conservada en ambos seguimientos mediante update,
  remove y add. Sólo la primera generación reemplazó la raíz preliminar.
- Consola sin errores. Esta prueba valida continuidad, no constituye una nueva
  auditoría de cada agregado financiero o de deduplicación de transferencias.

## Cambios de esta entrega

- Backend `shared-ui-stream.ts`: secuencia recursiva de patches por nodo;
  conserva contenedores compatibles y revisiones consecutivas. No-op no emite
  patch; reordenamiento o cambio incompatible utiliza replace seguro. La función
  anterior continúa disponible para compatibilidad.
- Backend `text-agent-service.ts`: emite la secuencia y traza inicio/continuación.
- Backend `agent-session-store.ts`: contexto acotado a 60 identidades e instrucción
  de reutilizar ids de funciones que siguen vigentes.
- Backend `tests/i9-conversational-continuity.test.ts`: cambios múltiples,
  eliminación/reordenamiento y tres mensajes en la misma sesión con contexto y
  revisiones encadenadas. No se ejecutan herramientas de pago en ese recorrido.
- Frontend `GenerativeCanvas.tsx`: sesión y revisión en diagnósticos existentes
  de desarrollo, no en UI productiva.

## Verificación

Backend 71/71 y build aprobados. Frontend build/typecheck, sincronización 4/4,
snapshot 3/3 y continuidad 5/5 aprobados. `git diff --check` aprobado.
Sin cambios de contratos, seeds ni pantallas prefabricadas; sin commits/push.
Servicios activos para continuar pruebas.

Arrastre de L8: continuidad exacta de scroll/foco sigue pendiente. L10 es la
siguiente fase, no implementada en esta entrega.
