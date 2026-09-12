# F10 — Rendimiento del frontend

Estado: alcance frontend aislado completo; métricas reales de red y backend pendientes de integración.

## Implementado

- Sampler rodante de p50/p95 para aplicación de UI Patch y patch-a-pintura, además de conteo de renders.
- Diagnóstico de rendimiento visible sólo en desarrollo.
- Batching por `requestAnimationFrame`: una ráfaga conserva el snapshot más reciente y produce un solo commit visual.
- Commits no urgentes mediante `startTransition`, sin retrasar controles ni estados financieros pendientes.
- Índice `nodeId → ruta` y actualización persistente con structural sharing.
- Fast path seguro para `update`: valida únicamente el nodo modificado y conserva el índice, porque el contrato común prohíbe cambiar identidad o estructura en esa operación.
- Validación completa y reconstrucción del índice para `add`, `remove`, `replace` y `move`.
- Especificaciones y nodos ya validados se reconocen internamente para no repetir recorridos.
- Memoización de nodos compartidos y contexto vacío estable para evitar renders falsos.
- Proyección de layout de Motion sólo ante un reordenamiento real; las actualizaciones de contenido conservan su animación ligera.
- ECharts continúa cargándose bajo demanda y se libera al desmontar.
- Las tablas sólo montan la página activa; el DOM ya está acotado por paginación, por lo que una segunda virtualización no aporta valor con el contrato actual.

## Verificación

- Gate `performance:verify`: batching, flush/discard, percentiles, seguridad del fast path y optimizaciones del runtime.
- Stress del motor: 60 updates consecutivos sobre una especificación de 421 nodos, con p95 por patch menor a 100 ms.
- Harness visual `/dev/performance-harness`, independiente del backend y no disponible en producción.
- Vista normal: 106 nodos y una ráfaga de 60 patches producen un solo commit y dos renders; las ejecuciones visuales dieron p95 entre 56.2 ms y 88.3 ms en modo desarrollo.
- `pnpm typecheck` y `pnpm build` terminan correctamente.

## Pendiente de integración

- Medir p50/p95 con streams reales, red, datos representativos y dispositivos objetivo.
- Comparar la primera UI útil contra la línea base del sistema integrado para demostrar la reducción requerida de 30%; el frontend aislado no puede atribuir el tiempo de inferencia ni de emisión del backend.
- Definir presupuestos por dispositivo y alertas CI usando muestras estables del entorno de integración.

El backend no fue modificado ni ejecutado durante esta fase.
