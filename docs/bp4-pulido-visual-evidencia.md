# BP4 · Pulido visual y coherencia

Estado: cerrada para la demo el 12 de septiembre de 2026.

## Correcciones aplicadas

- La ruta principal oculta el estado de backend/MCP/contrato y las trazas técnicas aun en desarrollo; los harnesses pueden solicitar esos diagnósticos explícitamente.
- La cuadrícula deja de reservar una fila vacía para diagnósticos ocultos. El compositor permanece en su fila propia, sin cubrir el resultado.
- La conclusión precede a la evidencia generada. El detalle de los parches queda en un desplegable secundario y no desplaza la respuesta principal.
- El título del resultado refleja la solicitud activa, no sólo la primera pregunta de la sesión. Un único hilo no ocupa una franja de historial.
- `[OBSERVED]` se retira de la presentación; `[SIMULATED]` se convierte en «Escenario simulado». Los importes de métricas, tablas, datos accesibles y tooltips monetarios muestran código de moneda.
- Se traducen tipos y estados frecuentes (`checking`, `savings`, `active`, etc.) sin alterar los datos ni los valores contractuales.
- Se compactó el estado inicial para que las tres sugerencias quepan en portátil y se acortó el placeholder del compositor en móvil.

## Validación

- Aplicación real en escritorio: estado inicial, resultado bancario, orden conclusión/evidencia, compositor y ausencia de diagnósticos técnicos.
- Vista móvil de 390 px: pantalla inicial y primera composición bancaria del harness sin desbordamiento horizontal; las tres sugerencias y el compositor quedan visibles.
- Teclado en navegador: Tab recorrió tema, tres sugerencias, campo de consulta y voz; Shift+Tab regresó al campo. El foco del compositor fue visible.
- Árbol de accesibilidad: encabezados, controles, región de resultado, tabla desplazable y etiquetas de campo identificables. No se ejecutó una sesión con un lector de pantalla externo.
- Temas claro y oscuro inspeccionados en vivo. Contraste calculado de texto principal/secundario/atenuado contra superficie: mínimo 4.97:1 en claro y 5.45:1 en oscuro.
- `pnpm banking:verify`: **12/12**.
- `pnpm quality:verify`: **7/7**.
- Pruebas de harnesses de streaming/interacción: **2/2**.
- `pnpm build`: correcto.
- Fingerprint contractual sin cambios: `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.

## Alcance

No se editó el backend, el contrato compartido, las fuentes MCP ni la lógica de autenticación. La UI financiera sigue siendo generada por el DSL; no se agregaron componentes bancarios prearmados.
