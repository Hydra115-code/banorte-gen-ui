# BP1 — Correcciones y evidencia en vivo

Fecha de validación: 12 de septiembre de 2026 (America/Denver).

## Resultado

Los pendientes críticos detectados al cerrar BP0 quedaron corregidos sin reemplazar la UI generativa por pantallas prefabricadas y sin modificar el contrato compartido.

| Pendiente | Corrección | Evidencia |
| --- | --- | --- |
| Tasa de ahorro mostrada como 800 % | La normalización conserva la semántica porcentual dentro de objetos anidados de `compare_periods` y transforma porcentajes base 100 a proporciones base 1. | Consulta en vivo: “Compara mi tasa de ahorro de julio y agosto de 2026 y explícame qué cambió.” La UI mostró 31.2 % para julio y 8 % para agosto. Correlation ID: `2f5873af-420a-4fe3-9925-e6c28237f48a`. |
| Tres llamadas para una comparación simple | Las instrucciones del agente exigen una sola comparación de los dos meses completos y evitan consultar cuentas cuando no se solicita seleccionar una. | La consulta en vivo ejecutó únicamente `compare_periods`; `toolCallCount: 1`. |
| Respuesta y UI demasiado extensas | El agente limita su explicación y el planner de Gen UI prioriza hasta cuatro métricas y las dos causas principales. | La UI en vivo mostró cuatro métricas y omitió la tabla completa de ocho categorías. El payload final fue de 1,344 bytes. |
| Tiempo total cercano a 20 segundos | Se eliminó trabajo redundante y se redujo la salida del modelo y del planner. | Línea base: ~19.9 s. Validación final: UI útil en 2,454 ms y stream completo en 9,938.63 ms. |
| El compositor cubría el resultado | El workspace usa un viewport fijo y reserva al compositor una fila real; sólo el canvas interno desplaza contenido. | Validación visual en viewport de 776 × 644: compositor visible fuera de la tarjeta desplazable, sin cubrir métricas. |
| Rechazo de funciones fuera de Banca personal sin recuperación | Los mensajes de alcance ofrecen consultas válidas para volver al flujo de Banca personal. | Prueba automatizada de política de alcance y recuperación aprobada. |
| JWT actualizado | Se validó el recorrido autenticado completo desde el navegador con sesión protegida. | La llamada autenticada llegó a Supabase, ejecutó MCP y finalizó sin 401. No se registró ni copió el token. |

## Cambios de backend

- Normalización recursiva de monedas y porcentajes en el adaptador del contrato compartido.
- Prueba de regresión para porcentajes anidados de `compare_periods`.
- Instrucciones específicas de Banca personal para periodos homogéneos, selección mínima de herramientas y respuestas breves.
- Planner de Gen UI consciente del alcance `personal`: máximo cuatro métricas y prioridad a variaciones relevantes.
- Mensajes de recuperación para solicitudes fuera del alcance seleccionado.

## Cambios de frontend

- El layout ocupa `100dvh` y evita scroll en los contenedores externos.
- El canvas mantiene su propio desplazamiento.
- El compositor dejó de ser `sticky` y ocupa una fila independiente del grid.
- Se agregó una verificación estática que impide reintroducir el solapamiento.

## Validaciones automatizadas

- Backend: `95/95` pruebas aprobadas.
- Backend: `pnpm typecheck`, `pnpm build` y `pnpm test:challenge` aprobados.
- Frontend Banca personal: `11/11` pruebas aprobadas.
- Frontend: `pnpm typecheck` y `pnpm build` aprobados.
- Fingerprint compartido: `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482` sin cambios.

## Criterio de cierre

BP1 queda cerrado para la demostración: la información financiera es correcta, la interfaz se genera desde la consulta y los datos obtenidos, el resultado es legible en viewport pequeño y el tiempo observado bajó de aproximadamente 20 a menos de 10 segundos. La latencia de Gemini puede variar entre ejecuciones; el producto ya entrega una UI provisional útil antes de completar la planificación final.
