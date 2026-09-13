# Plan de implementación — Banca personal generativa

## Decisión de producto

La entrega visible se concentra en una sola vertical: banca personal. El
problema que resuelve es explicar cambios en la situación financiera del
usuario y permitir que profundice o ajuste el análisis mediante lenguaje y
controles, generando una interfaz diferente en cada paso.

Pagos y educación financiera se conservan en el repositorio porque comparten
contratos e infraestructura ya probada. Se ocultan del producto presentado y
se excluyen de las herramientas disponibles para el agente en modo demo. No se
eliminan migraciones, herramientas ni pruebas existentes.

## Recorrido principal

1. «Aunque gané lo mismo, este mes ahorré menos. Explícame qué pasó.»
2. «Excluye la compra extraordinaria y vuelve a comparar.»
3. «Muéstrame solamente restaurantes y dime cuánto tendría que reducir para
   volver al nivel de julio.»
4. «Enséñame los movimientos que respaldan esa conclusión.»

Cada paso debe conservar el contexto, consultar datos o cálculos
deterministas y transformar la interfaz. Excluir una compra representa un
escenario; nunca modifica el movimiento observado.

## BP0 — Congelar alcance y proteger el producto

Prioridad: crítica.

Estado: **cerrada y validada en vivo el 12 de septiembre de 2026**. Evidencia:
[`bp0-evidencia-validacion.md`](./bp0-evidencia-validacion.md).

### Backend

- Incorporar un modo de alcance `personal_banking` configurado en servidor.
- En ese modo, exponer al modelo únicamente herramientas READ de cuentas,
  movimientos y análisis de gasto.
- Bloquear herramientas de pagos, crédito y simuladores educativos en la
  lista entregada al modelo, además de conservar sus autorizadores actuales.
- Cambiar el prompt del agente para describir con precisión las preguntas que
  sí resuelve y responder brevemente cuando una petición esté fuera de alcance.

### Frontend

- Retirar sugerencias, accesos y textos visibles de pagos y educación.
- Reemplazar las tres sugerencias genéricas por consultas de banca personal.
- Mantener ocultos los harnesses de desarrollo en el build presentado.
- Cambiar títulos genéricos de «Análisis financiero» por una propuesta clara
  de banca personal.

### Gate

- Ninguna acción visible prepara o confirma pagos.
- Una petición de pago o préstamo recibe una explicación de alcance y no
  invoca herramientas fuera de banca personal.
- Contratos compartidos y pruebas existentes continúan compilando.

## BP1 — Definir la verdad financiera y los casos de aceptación

Prioridad: crítica.

### Backend y datos

- Adoptar a Andrea Demo como historia principal.
- Documentar los resultados esperados de junio, julio y agosto: ingresos,
  gastos, flujo neto, tasa de ahorro, categorías y movimiento extraordinario.
- Verificar que cada cifra se obtenga de una herramienta, no del cálculo libre
  del modelo.
- Añadir, si las herramientas actuales no lo cubren, un cálculo READ
  determinista de ajuste de gasto. Recibe periodo, categoría o movimiento a
  excluir y devuelve escenario base, escenario ajustado y diferencia.
- Marcar toda salida como `OBSERVED` o `SIMULATED` desde datos estructurados.

### Casos de aceptación

- Saldo y cuentas actuales.
- Últimos movimientos con filtros.
- Por qué disminuyó el ahorro.
- Comparación homogénea entre dos meses.
- Detección y explicación prudente de un movimiento extraordinario.
- Escenario al excluir el extraordinario.
- Reducción necesaria de restaurantes para recuperar el margen anterior.

### Gate

- Fixture esperado y herramienta coinciden exactamente para todos los casos.
- No se mezclan monedas, cuentas ni periodos.
- Un escenario nunca se presenta como cambio real de saldo o historial.

## BP2 — Evaluar y corregir la respuesta real del agente

Prioridad: crítica.

### Ejecución

- Ejecutar al menos doce preguntas distintas contra Gemini real: cuatro
  directas, cuatro ambiguas y cuatro seguimientos.
- Registrar herramientas seleccionadas, respuesta, cifras, fuentes, latencia
  y errores de generación.
- Puntuar cada ejecución en exactitud, utilidad, claridad, selección de
  herramientas y adaptación de UI.
- Corregir el catálogo de capacidades, descripciones de herramientas y prompt
  usando únicamente fallos reproducidos.
- Limitar la respuesta inicial a una conclusión y dos o tres evidencias; el
  detalle debe aparecer bajo demanda.

### Gate

- Todas las preguntas del recorrido principal eligen las herramientas
  correctas en tres ejecuciones consecutivas.
- Cero cifras inventadas y cero afirmaciones acusatorias sobre anomalías.
- Las preguntas ambiguas solicitan el periodo o cuenta que falta.

## BP3 — Composición de GenUI específica para banca personal

Prioridad: alta.

Estado: **cerrada y validada en vivo el 12 de septiembre de 2026**. Evidencia:
[`bp3-composicion-gen-ui-evidencia.md`](./bp3-composicion-gen-ui-evidencia.md).

### Reglas de composición

- Pregunta simple: una o dos métricas y una conclusión, sin dashboard.
- Explicación de cambio: comparación, categorías responsables y evidencia.
- Exploración: filtros y lista o tabla de movimientos.
- Escenario: base y resultado ajustado con una indicación explícita de que es
  una simulación.
- Una sola acción primaria por estado.
- Mantener IDs de controles, filtros, selección y foco durante seguimientos.

### Fallbacks deterministas

- Resumen de cuentas.
- Comparación mensual.
- Desglose por categoría.
- Detalle de movimientos.
- Escenario de control de gasto.

Los fallbacks consumen las mismas fuentes MCP y el mismo contrato de UI. Se
usan cuando el planner genera una composición inválida, evitando mostrar una
tabla técnica genérica.

### Gate

- Las cuatro preguntas del recorrido producen composiciones distintas.
- Cada seguimiento reemplaza solo las partes afectadas.
- Un fallo del planner termina en una experiencia bancaria útil.

## BP4 — Pulido visual y coherencia

Prioridad: alta.

Estado: **cerrada para la demo el 12 de septiembre de 2026**. Evidencia:
[`bp4-pulido-visual-evidencia.md`](./bp4-pulido-visual-evidencia.md).

### Frontend

- Simplificar encabezado y retirar indicadores técnicos de la superficie para
  usuarios; conservarlos en un panel de diagnóstico de desarrollo.
- Corregir la superposición del compositor en los tamaños de presentación.
- Traducir tipos, estados y categorías; no mostrar `checking`, `active` ni
  nombres de campos internos.
- Formatear fechas en español de México, importes con moneda explícita y
  porcentajes con precisión consistente.
- Definir una jerarquía común: conclusión, métricas, visualización, evidencia
  y siguiente acción.
- Unificar espaciado, alturas, bordes, estados vacíos, carga, error y tema
  oscuro usando los tokens existentes.
- Probar escritorio, portátil y móvil; teclado y lector de pantalla.

### Gate

- Sin etiquetas técnicas, desbordamientos ni controles cubiertos.
- La conclusión principal es visible sin desplazamiento en portátil.
- Contraste, foco, etiquetas y navegación por teclado aprobados.

## BP5 — Voz con ElevenLabs

Prioridad: media; se ejecuta después de estabilizar texto y GenUI.

Estado: **cerrada para la demo de banca personal**. Evidencia, límite de precisión numérica y revisión obligatoria en `docs/bp5-voz-elevenlabs-evidencia.md`.

### Integración

- Validar el token efímero y `scribe_v2_realtime` con una sesión Supabase.
- Probar transcripción parcial y confirmada en español.
- Conservar la transcripción como borrador editable; nunca enviarla
  automáticamente.
- Probar cantidades, meses, categorías, pausas, ruido y cancelación.
- Mostrar estados breves: conectando, escuchando, listo y error recuperable.
- Desactivar u ocultar el micrófono si el servicio no pasa el gate antes de
  congelar la entrega.

### Gate

- La primera pregunta del recorrido puede dictarse y editarse antes de enviar.
- La consulta escrita y la dictada producen el mismo significado y UI.
- Negar permiso o perder conexión no impide escribir una consulta.

## BP6 — Sesión demo y continuidad

Prioridad: alta.

Estado: **cerrada para la demo local el 12 de septiembre de 2026**. Evidencia en `docs/bp6-sesion-demo-continuidad-evidencia.md`. El entorno de entrega deberá configurar por separado los secretos de demo si se desea acceso con un clic.

### Autenticación

- Usar Andrea Demo como usuario real de Supabase con RLS normal.
- Implementar renovación server-side mediante el refresh token existente.
- Rotar cookies HttpOnly y reintentar una consulta READ una sola vez.
- No añadir bypass ni exponer credenciales, service role o tokens al cliente.
- Opcionalmente ofrecer «Entrar a demostración», habilitado únicamente con una
  variable de ambiente y autenticando a Andrea mediante Supabase en servidor.

### Gate

- La sesión sobrevive todo el ensayo sin pedir un nuevo login.
- Un refresh fallido conserva la consulta y conduce al login correcto.
- Datos de Andrea, Bruno y Carla permanecen aislados.

## BP6.5 — Primera UI útil más rápida, sin recortar la respuesta

Prioridad: alta, después de BP5 y antes del ensayo final BP7.

Estado: **cerrada y validada el 2026-09-13**. Evidencia y resultados pareados en [`docs/evidence/bp65-performance.md`](./evidence/bp65-performance.md). La mediana global de primera UI útil bajó de 12.76 s a 3.75 s (-70.6 %), la mediana final de 13.15 s a 12.66 s y las corridas completas pasaron de 12/15 a 15/15.

### Objetivo y límites

- Reducir los segundos entre **Enviar** y la primera UI **pintada y útil** (un dato bancario real, periodo y contexto de la petición), además del tiempo hasta la UI final. Un spinner, estado, tabla genérica no pertinente o primer nodo vacío no cuenta como UI útil.
- Mantener respuesta completa, todas las herramientas MCP necesarias, fuentes y evidencia, validaciones de contratos/semántica/razonamiento, RLS, revisiones de patches y accesibilidad. No limitar movimientos, categorías, nodos, tokens ni profundidad de respuesta sólo para ganar milisegundos; no sustituir la UI final generada por un dashboard fijo.
- No cachear datos bancarios de un usuario como si fueran públicos ni omitir verificaciones de seguridad. Un resultado provisional sólo puede mostrar datos ya recibidos y validados, identificarse como actualización en curso y evolucionar mediante el DSL y patches existentes hasta la composición final.

### Implementación, en orden y con gate por paso

1. **Instrumentar y fijar la línea base.** Correlacionar por `correlationId` los spans existentes de agente, Gemini, MCP, Supabase y generador de UI con `GenerationObserver` y `FrontendPerformanceSampler`. Añadir una marca en el navegador tras `requestAnimationFrame` del primer contenido pertinente y enlazado a datos; registrar también UI final, bytes, número de tool calls, intentos de modelo/UI, patches y error. Exportar un registro de medición sin prompts, JWT ni datos financieros. Medir las cinco pruebas de abajo *antes* de editar el pipeline.
2. **Atacar sólo el tramo dominante.** En el backend, perfilar creación de `AgentRuntime`/MCP por petición, `listTools`, decisiones de Gemini, consultas Supabase y `GeminiUiGenerator.generate`. Los tool calls de un mismo lote **ya se ejecutan en paralelo**: conservarlo, no duplicar llamadas ni cambiar su orden semántico. Si pesa `listTools`, reutilizar únicamente definiciones públicas/estables por ámbito y versión, con invalidación; jamás resultados financieros ni autorización de otro usuario. Si pesa el armado de runtime, evaluar reutilización segura de recursos sin compartir una sesión Supabase entre usuarios.
3. **Adelantar contenido útil, no adelantar conclusiones.** Si la espera principal es el JSON completo de Gemini, extender el `ui-started` provisional sólo a casos donde ya haya fuentes MCP válidas y una composición pertinente a la intención. Conservar todos los resultados pendientes y aplicar `data-patch`/`ui-patch` validados para completar la misma UI generativa. Medir por separado primer dato, primer nodo y primera UI útil; retirar cualquier provisional que no mejore la utilidad real o contradiga la UI final.
4. **Reducir trabajo redundante sin pérdida semántica.** Si las trazas muestran reintentos de UI, corregir la causa de schema/semántica en prompt o reparación puntual y mantener la validación completa. Si dominan serialización/paint, reutilizar referencias a `dataSources` y el batching/memoización ya presentes, sin eliminar filas, evidencia o nodos. No cambiar la política de reintentos de Gemini/MCP ni compactar el contexto hasta confirmar con pruebas que el fallo o la latencia vienen de allí.
5. **Comparar y decidir.** Aplicar una sola optimización por vez y repetir las cinco pruebas pareadas. Conservar sólo experimentos con mejora medible y sin regresión funcional; el conjunto de cambios debe reducir la mediana global de primera UI útil **al menos 20 %** sin empeorar más de 10 % el peor caso ni el tiempo final. Si no se alcanza, documentar el cuello de botella real y revertir sólo el experimento que perjudique el producto, no sus funciones.

### Cinco pruebas pareadas de UI generativa

Cada caso se ejecuta con Andrea Demo y el seed fijo de junio–agosto de 2026: una corrida de calentamiento no medida y tres corridas medidas **antes y después** de cada cambio, en el mismo hardware, versión de modelo, red y estado de caché. Para cada corrida registrar en **segundos con dos decimales** `primera UI útil` y `UI final`, además de agente, MCP, planner, Supabase y paint. Reportar las tres muestras, mediana, peor caso y diferencia absoluta/porcentual; no comparar una corrida fría con otra caliente. Cada respuesta debe pasar contrato, coherencia financiera y evidencia.

| Prueba | Petición / interacción | Qué no puede perderse |
|---|---|---|
| 1. Saldo | «¿Cuánto tengo disponible en mis cuentas MXN?» | Identidad, moneda, cuentas correctas y distinción entre saldo y disponible. |
| 2. Movimientos | «Muéstrame los movimientos de restaurantes de agosto de 2026» | Periodo, todas las filas recuperadas, paginación y fuentes. |
| 3. Comparación | «Compara mis gastos de julio y agosto de 2026 por categoría y explícame las variaciones» | Ambos periodos, importes, diferencias y categorías pertinentes. |
| 4. Explicación | «Si gané lo mismo en julio y agosto de 2026, ¿por qué ahorré menos en agosto? Susténtalo con movimientos» | Razonamiento trazable, sin inventar causas ni omitir evidencia. |
| 5. Seguimiento dinámico | Tras la prueba 3, pedir «Enfócate en entretenimiento y muestra los movimientos que explican el aumento» | Misma sesión, datos actualizados, patches/revisiones válidos, foco y estado preservados. |

### Gate de BP6.5

- Tabla **antes/después** de las cinco pruebas con segundos de UI útil y UI final; mejora global de mediana ≥20 %, peor caso y total sin regresión >10 %.
- Cinco de cinco resultados financieramente correctos y completos; mismos hechos, fuentes y permisos de lectura que antes. Fingerprint contractual idéntico y sin cambios de RLS, pagos o verticales ocultas.
- `build`, pruebas de contratos, banca personal, continuidad, parches, accesibilidad y rendimiento pasan en front y back. Una revisión visual confirma que la primera UI útil no es un placeholder y que la UI final no perdió contenido.

## BP7 — Rendimiento, ensayo y congelación

Prioridad: final, obligatoria antes de entregar.

### Medición

- Tomar la tabla validada de BP6.5 como referencia y repetir tres veces cada
  paso del recorrido para detectar regresiones de agente, MCP, planner,
  primera UI útil y total.
- Evitar reintentos completos cuando exista un fallback determinista válido.
- Mantener datos visibles mientras se actualiza la composición.

### Entrega

- Ejecutar build y suites completas de frontend y backend.
- Verificar fingerprint contractual idéntico.
- Restaurar el seed de demo y ejecutar el recorrido una última vez.
- Preparar README de arranque, variables necesarias, credenciales demo y
  guion de presentación.
- Congelar funcionalidad antes del ensayo final.

### Gate

- Tres recorridos consecutivos sin error funcional.
- Repositorios reproducibles desde una instalación limpia.
- Plan alterno documentado para caída de Gemini o ElevenLabs.

## Orden estricto de ejecución

1. BP0 — alcance.
2. BP1 — verdad financiera.
3. BP2 — calidad real del agente.
4. BP3 — composición generativa y fallbacks.
5. BP4 — pulido visual.
6. BP6 — continuidad de sesión.
7. BP5 — voz.
8. BP6.5 — optimización medida de primera UI útil.
9. BP7 — ensayo y entrega.

BP6 se implementa antes de BP5 porque la transcripción también depende de una
sesión autenticada. Si el tiempo se reduce, se conserva banca personal escrita
y se omite voz antes de sacrificar exactitud, continuidad o claridad visual.
