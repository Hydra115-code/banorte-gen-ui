# BP2 — Calidad real del agente

Fecha de validación: 12 de septiembre de 2026.

## Resultado

BP2 queda cerrada. Se evaluaron consultas reales contra Gemini, MCP y Supabase, además de seguimientos desde la interfaz autenticada. No se aceptó la fase hasta corregir los fallos reproducibles encontrados.

## Fallos encontrados y corrección

| Hallazgo | Corrección aplicada | Validación final |
| --- | --- | --- |
| Gemini entregó `OBSERVED:` sin conclusión | El validador de razonamiento rechaza etiquetas sin contenido y solicita una regeneración con el mismo contexto. | La repetición de cuentas mostró una conclusión legible y tres saldos vinculados. |
| Una consulta sobre movimientos explicaba sólo categorías agregadas | El prompt exige `get_transactions` para movimientos individuales y combina `compare_periods` con transacciones cuando se explica un cambio entre periodos. | Tres ejecuciones obtuvieron fuentes `comparisons` y `transactions`, sin errores. |
| Preguntas temporales ambiguas inventaban un periodo | Se agregó una respuesta local de aclaración para gastos, comparaciones y movimientos sin fechas ni contexto. | Cuatro preguntas ambiguas pidieron periodo en ~0.6 s sin Gemini ni MCP. |
| Seguimientos de categoría o variación eran bloqueados | La política reconoce expresiones conversacionales de Banca personal. | En UI: comparación → Restaurantes → variación frente a julio → movimientos explicativos, con parches incrementales. |
| La detección de ambigüedad confundía `8 meses` | El reconocimiento de periodo cubre singulares y plurales. | I8 de sincronización de patches volvió a pasar. |

## Recorridos reales

Las siguientes cuatro consultas eligieron las fuentes correctas en tres ejecuciones consecutivas, sin errores de stream:

| Consulta | Fuentes verificadas |
| --- | --- |
| Cuentas y saldos | `accounts` |
| Comparación julio-agosto | `comparisons` |
| Movimientos que explican el cambio | `comparisons` + `transactions` paginadas |
| Movimientos atípicos | `anomalies` |

La latencia end-to-end observada en esas repeticiones fue de 7.5 a 15.3 segundos. Es una línea base para BP7; no se ocultó ni se presentó como una garantía.

## Evidencia visual de continuidad

En una sesión autenticada real:

1. La comparación mostró agosto contra julio y las causas principales.
2. “Ahora muestra sólo restaurantes” conservó el periodo y filtró la respuesta a esa categoría.
3. “¿Cuánto cambió respecto a julio?” calculó $1,750 MXN (+50.00%).
4. “Muéstrame los movimientos que explican ese cambio” mostró 14 transacciones de restaurantes y explicó el aumento del ticket promedio de $500 a $750 MXN con la misma frecuencia mensual.

## Regresión final

- Backend: 97/97 pruebas aprobadas, typecheck y build aprobados.
- Frontend Banca personal: 11/11 pruebas aprobadas y build de producción aprobado.
- El fingerprint compartido se conserva sin cambio: `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.

## Revalidación de exactitud · 12 de septiembre de 2026

Una evaluación posterior de diez preguntas abiertas reabrió dos casos que el gate inicial no cubría. Ambos quedaron corregidos y probados contra la demo real:

- **Anomalías sin muestra suficiente.** Si `eligibleGroups` es cero, el razonamiento y la UI ya no pueden afirmar que no existen anomalías. La respuesta debe indicar que los datos no permiten determinar presencia ni ausencia, mostrar las 25 transacciones evaluadas, cero grupos elegibles y el mínimo de ocho en lenguaje comprensible. La repetición real respondió así en 15.6 s, sin errores de stream ni parches.
- **Transferencias históricas propias.** Consultarlas ya no se confunde con ordenar una transferencia. Ejecutar o preparar transferencias continúa bloqueado. El agente exige `get_transactions` filtrado a transferencias, periodo solicitado y paginación completa; la UI exige una tabla de esos movimientos o un estado vacío explícito, nunca una tabla de saldos como sustituto.

Durante la prueba se comprobó por conteo de sólo lectura que la instancia Supabase tenía 75 movimientos y cero transferencias, mientras el seed versionado define 78 y tres. Con autorización explícita se insertaron únicamente las tres filas sintéticas faltantes (19 de junio, julio y agosto de 2026). El conteo posterior fue 78/3. La consulta real mostró las tres transferencias de $2,000 MXN, total $6,000 MXN, y explicó que son movimientos internos sin contarlas como gasto; tardó 13.0 s, generó tabla filtrable y no produjo errores.

La validación visual encontró además que la gráfica comparativa se comprimía a ~177 px dentro de un panel móvil de ~381 px. Se corrigió para ocupar todo el ancho. También se descartó la UI provisional cuando sólo podía mostrar “Moneda: MXN” y se integró el PNG real de Banorte en acceso y cabecera. Backend: **109/109** pruebas y build correctos. Frontend: typecheck y build de producción correctos.
