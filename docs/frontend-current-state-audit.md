# Auditoría del estado actual del frontend

Fecha de revisión: 2026-09-12

## Alcance

Esta auditoría evalúa el frontend de manera aislada contra el plan F0–F10. El backend se utilizó únicamente como referencia de lectura para evitar diseñar integraciones incompatibles. No se modificó ni se levantó el backend.

## Resultado de compilación y revisión visual

| Verificación | Resultado | Observación |
| --- | --- | --- |
| `pnpm typecheck` | Cumple | TypeScript estricto termina sin errores |
| `pnpm build` | Cumple | Build de producción completo con Webpack |
| Next/Turbopack en build | Bloqueado por entorno | PostCSS intenta crear un proceso y enlazar un puerto; devuelve `Operation not permitted` |
| Desarrollo local | Cumple | La página responde `200` y compila con Turbopack |
| Escritorio claro/oscuro | Cumple | Jerarquía, contraste funcional y cambio de tema correctos |
| Vista móvil | Cumple con mejora | El contenido permanece operable; se eliminó el truncado del chip de estado |
| Backend no disponible | Cumple | El estado del sistema y el envío degradan de forma controlada, sin romper el canvas |
| Consola del navegador | Cumple | Sin errores de aplicación durante la prueba |

El build usa la API estable de TypeScript de Next porque su ruta experimental CLI no captura correctamente `tsc --showConfig` en este entorno. El script conserva `pnpm typecheck` como gate obligatorio antes de generar el bundle.

## Estado por fase

### F0 — Contratos canónicos: completo en el frontend

Ya cumple:

- `@banorte/contracts` se consume desde el entrypoint raíz.
- Las fachadas de schemas dentro de `src` reexportan el contrato común; no mantienen otra definición pública.
- El código valida solicitudes, eventos, UI, Data Patches y UI Patches.
- Existe un adaptador central de eventos hacia data parts de AI SDK.
- Frontend y backend tienen actualmente fuentes y manifiesto del paquete de contratos idénticos.
- Hay pruebas básicas de compatibilidad contractual y revisiones inválidas.
- Los streams canónicos rechazan versiones no soportadas y secuencias duplicadas o regresivas.
- Los errores de protocolo llegan a la UI con códigos específicos y no se convierten en un error genérico de red.
- Hay fixtures deterministas de banca personal, educación financiera y preparación de pagos.
- El catálogo de fixtures cubre los 33 tipos de nodo y los cinco tipos de UI Patch.
- Existe un harness visual de desarrollo que no depende del backend y responde 404 en producción.

No repetir:

- recrear schemas de nodos en el frontend;
- crear otro protocolo para AI SDK;
- agregar subpaths privados al paquete compartido.

Pendiente para integración, no para el frontend aislado:

- sustituir o complementar los fixtures locales con fixtures publicados por el backend cuando estén disponibles.

### F1 — Sesión y máquina de estados: completo en el frontend

Ya cumple:

- once estados explícitos;
- separación de conversación, UI, Data Registry y pago;
- AI SDK se trata como transporte, no como estado financiero;
- una actualización y una cancelación conservan el último snapshot válido;
- los conflictos de revisión se presentan como resultado parcial recuperable;
- Zustand funciona como caché visual en memoria.
- La sesión activa y hasta ocho snapshots se restauran al recargar la misma pestaña.
- La persistencia efímera tiene TTL, límite de bytes y revalidación contractual.
- No se guardan datos financieros en `localStorage` ni diagnósticos/correlation IDs en el archivo.
- Los datos incluidos junto con una UI forman parte del mismo Data Registry restaurable.

Pendiente de integración:

- recuperar un snapshot autoritativo del backend, no sólo conservar la caché local validada.

Bloqueo de integración: el backend conserva sesiones en memoria, pero no expone una ruta para consultar/restaurar un snapshot por `sessionId`.

### F2 — Runtime de componentes: completo en el frontend

Ya cumple:

- render seguro de todos los tipos de nodo contractuales actuales;
- layouts, contenido, tablas, visualizaciones, formularios y lógica condicional/repetitiva;
- IDs estables y límites de nodos;
- no se ejecutan HTML, JSX, CSS o JavaScript enviados por el modelo;
- estados sin datos, bindings incompletos y degradación estructurada;
- formato regional y monetario;
- alternativa tabular accesible para visualizaciones.
- matriz ejecutable para los 33 tipos de nodo y sincronización contra el renderer real;
- fixtures contractuales de las tres verticales;
- enmascaramiento uniforme de cuentas, tarjetas, PAN, CLABE e IBAN en bindings, tablas y visualizaciones;
- gate dedicado de capacidades y masking.

Pendiente para integración:

- sustituir o complementar los fixtures frontend-only con fixtures oficiales emitidos por el backend.

### F3 — Cambio de UI provocado por texto: completo en el frontend

Ya cumple:

- el texto sólo se envía al confirmar, no por cada tecla;
- follow-ups incluyen sesión, revisión de UI, revisión de datos y data keys;
- la UI vigente permanece visible durante una actualización;
- los patches cambian únicamente nodos afectados;
- existe historial en memoria y conservación condicionada del scroll.
- cada actualización terminada explica hasta cinco cambios asociados a su revisión;
- el resumen cubre patches, datos y reemplazos completos sin exponer valores financieros;
- el foco y la selección se conservan cuando el control sobrevive o mantiene su ID;
- los controles se reinician sólo cuando cambian propiedades contractuales incompatibles;
- la explicación se conserva en historial y restauración de pestaña;
- existen gates y harness frontend-only para refinamiento, presentación y cambio de vertical.

Pendiente para integración:

- E2E desde texto libre contra respuestas reales del backend para refinamiento, presentación y cambio de vertical.

### F4 — Cambio provocado por interacción: completo en el frontend

Ya cumple:

- controles que emiten eventos tipados con `sourceId`, valor, sesión y revisiones;
- bloqueo por nodo pendiente;
- sliders con previsualización local y envío al soltar o confirmar con teclado;
- filtros y paginación local de tablas;
- las acciones financieras no se ejecutan directamente desde un handler generado.
- registro síncrono por nodo que impide dobles clics antes del re-render;
- finalización estrictamente correlacionada por `sourceId` y `correlationId`;
- reintento del mismo intent contractual, conservando su identidad;
- política explícita para eventos visuales, simulaciones, análisis y acciones financieras;
- harness y gate frontend-only para deduplicación, respuestas obsoletas y reintentos.

Pendiente para integración:

- E2E de una simulación y un análisis contra respuestas reales del backend;
- idempotencia autoritativa para acciones financieras, bloqueadas hasta F7/integración.

### F5 — Banca personal: completo en el frontend

Ya cumple:

- superficie inicial vacía y generativa;
- métricas, tablas paginadas, gráficas, filtros, comparaciones y alertas pueden componerse con el DSL actual;
- continuación por texto desde la misma superficie.
- cuatro composiciones diferenciadas para saldo, movimientos, gasto y comparación sin tabla;
- periodo consultado y evidencia visibles en cada composición;
- paginación local comprobada con más de una página;
- observaciones estadísticas sin acusaciones de fraude;
- series verificadas para no mezclar cuenta o moneda;
- gate contractual y harness visual independientes del backend.

Pendiente para integración:

- E2E de las cuatro consultas con eventos y datos reales del backend;
- refinamiento real por texto y controles contra la misma sesión autoritativa.

### F6 — Educación financiera: completo en el frontend

Ya cumple:

- el runtime puede componer diagnóstico, evidencia, acordeones, recomendaciones, sliders, progreso y escenarios;
- el backend de referencia dispone de simulación de crédito y ahorro.
- conclusión breve antes del detalle;
- patrón visual diferenciado para datos observados, simulación y recomendación;
- evidencia y periodo expandibles;
- aviso obligatorio de que la simulación no constituye una oferta financiera;
- flujo de restricción escrita que conserva el diagnóstico y actualiza sólo escenario/recomendación;
- reconciliación de aportación y proyección mediante revisiones contractuales;
- siguiente acción concreta sin ejecutar operaciones financieras;
- gate y harness visual independientes del backend.

Pendiente para integración:

- E2E de diagnóstico, restricción y slider contra datos/eventos reales del backend;
- validar personalización con datos autoritativos del usuario.

### F7 — Pagos: preparación frontend completa; ejecución bloqueada

Ya cumple:

- captura explícita de cuenta, beneficiario, monto, concepto y fecha;
- revisión separada con cuenta enmascarada, monto, moneda, comisión, fecha y saldo estimado posterior;
- textos exactos `Revisar pago` y `Confirmar y pagar`;
- revisión como intent no autoritativo y protección contra doble clic;
- confirmación, ejecución, envío y reintento bloqueados por política;
- edición/cancelación limitadas al borrador y revisión;
- error recuperable que conserva los datos;
- gate contractual y harness visual independientes del backend;
- ausencia deliberada de éxito, referencia, comprobante o movimiento fabricados.

Pendiente para integración:

- contratos compartidos de intent, autenticación, confirmación, idempotencia, ejecución, error y resultado;
- comprobante autoritativo y actualización de movimientos/saldo después del éxito confirmado por backend.

### F8 — Patches, continuidad y recuperación: frontend aislado completo

Ya cumple:

- aplicación estricta de revisiones de UI y datos;
- rechazo de revisiones base obsoletas;
- límites de historial;
- IDs estables, degradación segura y conservación del último resultado;
- limpieza de instancias ECharts y listeners.
- identidad referencial de ramas no modificadas incluso después de la validación completa;
- índice inmutable `nodeId → ruta` por revisión;
- conservación comprobada de foco, edición, tab, acordeón y scroll durante patches ajenos;
- reconciliación de tabs/acordeones cuando su opción activa desaparece;
- los conflictos conservan el snapshot válido y no ofrecen un reintento ciego;
- retry correlacionado para intents no autoritativos y acciones financieras bloqueadas hasta contar con idempotencia backend;
- gate y harness visual independientes del backend.

Pendiente para integración:

- solicitar y recibir el snapshot autoritativo vigente después de un conflicto; el contrato/backend actual no expone esa operación.

### F9 — Seguridad, accesibilidad y pruebas: frontend aislado completo

Ya cumple:

- CSP, encabezados de seguridad y secretos sólo server-side;
- no se encontró persistencia financiera en `localStorage`;
- nodos generados sin contenido ejecutable;
- ARIA, navegación nativa por teclado, tabla alternativa y reducción de movimiento;
- error boundaries y degradación ante payload inválido.
- correlation IDs y diagnósticos internos ocultos fuera de desarrollo;
- límite UTF-8 de 16 KiB alineado con el backend actual;
- auditor automatizado de accesibilidad para las tres verticales;
- errores con anuncio y foco gestionado;
- aplicación real de los cinco tipos de patch cubierta por pruebas;
- casos seguros de pago duplicado, saldo insuficiente y sesión expirada;
- gate de calidad y harness visual para las tres verticales y payload inválido.

Pendiente para integración:

- E2E de las tres verticales con datos/eventos reales;
- foco en confirmación y comprobante cuando existan estados contractuales autoritativos de pago.

### F10 — Rendimiento: frontend aislado completo

Ya cumple:

- instrumentación de latencias, bytes, eventos y patches;
- medición de primera UI útil y render del frontend;
- carga diferida y liberación de ECharts;
- conservación de UI durante follow-ups;
- sampler rodante de p50/p95 para patch apply y patch-a-pintura;
- conteo de renders y diagnóstico exclusivo de desarrollo;
- batching por frame con un solo commit para ráfagas y `startTransition`;
- fast path indexado para updates, con validación del nodo modificado e índice estable;
- validación completa para operaciones estructurales;
- structural sharing, confianza interna y memoización selectiva de nodos;
- contexto pendiente vacío estable y layout projection sólo ante reordenamientos reales;
- tablas con DOM acotado a la página activa;
- gate automatizado sobre 421 nodos y harness visual de vista normal;
- p95 visual entre 56.2 ms y 88.3 ms para 60 patches sobre 106 nodos, con un commit y dos renders.

Pendiente para integración:

- p50/p95 con streams, red, datos y dispositivos reales;
- línea base integrada para demostrar la reducción de 30% en primera UI útil;
- presupuestos CI calibrados con el entorno final.

## Compatibilidad con el backend actual

Compatibilidades confirmadas:

- contrato versión `1`;
- endpoint `POST /api/agent` con NDJSON;
- `sessionId`, `correlationId`, revisiones y data keys;
- datos disponibles para banca personal y simulaciones educativas;
- bearer token sólo en la ruta server-side del frontend.

Riesgos que deben resolverse durante la integración:

1. No existe recuperación autoritativa de sesión por `sessionId` después de recarga.
2. No existen contratos ni herramientas autoritativas de pagos.
3. Los fixtures contractuales del backend aún no forman parte del gate visual del frontend.
4. La mejora de 30% en primera UI útil requiere una línea base conjunta y no puede certificarse sólo desde el frontend.

## Próximo trabajo recomendado, sin duplicar

F0–F10 están cerradas dentro del alcance frontend aislado. La siguiente unidad es la fase de integración: ejecutar las tres verticales contra eventos reales, medir la primera UI útil con una línea base común y resolver recuperación autoritativa e idempotencia de pagos antes de habilitar ejecución financiera.
