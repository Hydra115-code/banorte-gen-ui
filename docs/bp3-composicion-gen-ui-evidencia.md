# BP3 · Composición GenUI de Banca Personal

Estado: **cerrada y validada en vivo el 12 de septiembre de 2026**.

## Cambio aplicado

La recuperación de UI del backend ya no devuelve una experiencia técnica genérica cuando el planner produce JSON inválido. Sólo dentro del alcance `personal_banking`, genera composiciones pequeñas y enlazadas a las mismas fuentes MCP:

- Cuentas: métrica de cuentas disponibles y tabla de saldos.
- Comparación entre periodos: de dos a cuatro métricas y categorías comparables, ordenadas por impacto; si hay varias, gráfica y tabla explorable.
- Gasto por categoría: visualización y tabla de detalle.
- Movimientos: tabla de evidencia; si explica una comparación, conserva además el resumen de variación.
- Anomalías: tabla de señales estadísticas con aviso explícito de que no prueba fraude.

El validador semántico fuerza estas composiciones únicamente cuando el `GeminiUiGenerator` opera con scope `personal_banking`; pagos, educación y los flujos legacy no se alteran. Los fallbacks siguen usando el DSL y el contrato compartido: no se agregaron componentes predefinidos ni valores financieros inventados en el frontend.

## Pruebas ejecutadas

- `pnpm typecheck` en backend: correcto.
- Suite completa del backend: **102/102**.
- `pnpm banking:verify` en frontend: **11/11**.
- `pnpm integration:data:verify` en frontend: **6/6**.
- `pnpm build` en frontend: build de producción correcto, incluidas las rutas dinámicas y los harnesses de desarrollo.
- Prueba de recuperación BP3: cinco composiciones, respuesta útil desde el primer JSON inválido del planner y rechazo explícito de una tabla desnuda para cuentas/comparaciones.
- El fingerprint de contrato se conservó: `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.

## Evidencia visual en producto

La validación se realizó desde la aplicación real en `http://localhost:3000/`, con Supabase, agente y streaming activos:

- `Muéstrame mis cuentas y saldos`: mostró métricas de cuentas y una tabla de tres cuentas con identificadores enmascarados; no creó un dashboard innecesario.
- `¿Por qué cambiaron mis gastos de julio a agosto de 2026?`: mostró tres métricas de comparación, variación y las dos categorías principales con evidencia.
- `Muéstrame mis gastos por categoría de agosto de 2026`: mostró gráfica y tabla con ocho categorías y porcentajes normalizados.
- `Muéstrame los movimientos de restaurantes de agosto de 2026`: mostró una tabla de siete movimientos con fecha, descripción, categoría e importe.

Las cuatro consultas produjeron composiciones distintas y conservaron la actualización incremental de la zona generada.

## Correcciones descubiertas durante la validación

- La ruta proxy del frontend renueva en servidor un JWT próximo a vencer mediante el refresh token HttpOnly, rota las cookies y conserva la consulta.
- El clasificador del backend evalúa la solicitud nueva sin confundirla con nombres de producto presentes en el historial; los seguimientos elípticos legacy continúan funcionando sólo en su alcance completo.
- Una respuesta que afirme que sí o que no existen anomalías debe estar respaldada por `detect_transaction_anomalies`.

No se modificó el contrato compartido ni se añadieron componentes bancarios prearmados: la composición sigue siendo GenUI basada en el DSL y en las fuentes MCP.

## Revalidación de preguntas abiertas y edición · 12 de septiembre de 2026

La evaluación textual posterior detectó una regresión que el cierre original no cubría: una pregunta abierta podía devolver sólo métricas y tabla, sin gráfica; un filtro por categorías podía anunciarse en el texto sin aplicarse a las filas; y la vista de liquidez omitía movimientos del periodo que no fueran egresos precedentes. Se corrigió el enlazado de datos y el validador para que una comparación con varias categorías visibles incluya gráfica comparativa y tabla, salvo exclusión explícita del usuario. La tabla del contrato compartido ahora activa búsqueda y ordenamiento local cuando hay varias filas; el frontend ya implementaba esos controles.

Prueba en vivo, mismo usuario demo y streaming real, sin cambios al contrato compartido:

| Consulta | Tiempo total | Resultado verificado en el contrato emitido |
| --- | ---: | --- |
| Abierta: cambio de gastos julio/agosto y qué notar primero | 11.9 s | Gráfica agrupada (16 puntos: dos series por ocho categorías), tabla de ocho categorías con búsqueda y ordenamiento. |
| Seguimiento: enfocar gráfica y tabla en entretenimiento/restaurantes | 10.2 s | UI actualizada en la misma sesión; gráfica de cuatro puntos y tabla de dos filas; cero errores de parches. |
| Misma pregunta abierta en sesión nueva | 12.5 s | Misma estructura útil, gráfica y tabla de ocho categorías; cero errores de parches. |

Otra consulta de liquidez y su seguimiento del 10 al 20 de agosto devolvieron heatmap con 25 y ocho días respectivamente, egresos precedentes (ocho y tres) y tabla independiente de **todos** los movimientos del rango (ocho, incluido un ingreso). HTTP 200 y cero errores de parches. La suite del backend pasó **105/105**, compilaron backend y contratos, y `pnpm typecheck` del frontend terminó correctamente.

Esta revalidación fue por eventos y datos del producto, **no** una inspección visual nueva del navegador ni una medición controlada de BP6.5. No sustituye el gate de rendimiento de cinco pruebas ni corrige por sí sola los pendientes de exactitud de BP2.
