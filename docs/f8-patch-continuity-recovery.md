# F8 — Patches, continuidad visual y recuperación

Estado: alcance frontend aislado completo; recuperación autoritativa pendiente de integración.

## Implementado

- Aplicación estricta y consecutiva de UI/Data Patches.
- Rechazo de revisiones base obsoletas conservando exactamente el último snapshot válido.
- Índice inmutable `nodeId → ruta` reconstruido después de cada patch válido.
- Structural sharing real después de validar: sólo cambian las referencias de la ruta afectada.
- Especificaciones y nodos validados marcados internamente para evitar clones adicionales en el renderer, sin confiar en entradas sin validar.
- Estado local preservado por ID estable: foco, selección de texto, valor en edición, tab, acordeón y scroll.
- Reconciliación segura si desaparece el tab o panel abierto.
- Animación y resaltado limitados a nodos realmente modificados o pendientes.
- Conservación y degradación de la última UI útil ante interrupciones.
- Un conflicto no ofrece reintento ciego: conserva la revisión válida y evita repetir una operación.
- Degradación a datos estructurados cuando la UI ideal es inválida o incompleta.
- Gate unitario y harness visual independiente del backend en `/dev/patch-continuity-harness`.

## Pendiente de integración

El contrato actual permite informar un conflicto pero no solicitar ni recibir explícitamente el snapshot autoritativo vigente por `sessionId`. Por seguridad, el frontend queda en estado parcial y no reenvía la operación. Para cerrar el E2E se necesita una operación contractual de recuperación que entregue, de forma atómica:

- revisión de UI y especificación vigentes;
- revisión y contenido del Data Registry;
- claves invalidadas;
- identidad de sesión;
- criterio para retomar el stream sin reutilizar una acción financiera.

El backend no fue modificado ni ejecutado durante esta fase.
