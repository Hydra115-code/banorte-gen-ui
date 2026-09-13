# Evidencia BP6.5 — primera UI útil

Fecha: 2026-09-13. Entorno: Andrea Demo, seed fijo junio–agosto de 2026, frontend local y backend local, mismo contrato compartido y mismo proveedor/modelo.

## Método

- Una corrida de calentamiento no medida y tres corridas medidas por caso.
- Se midieron primer dato, primer nodo, primera composición pertinente y ligada a fuentes, y cierre de UI.
- La UI genérica `provisional-root` no se contó como útil. En seguimientos tampoco se contó la UI anterior preservada: el reloj se detuvo con la primera revisión nueva.
- Los fallos sin UI útil de la línea base se penalizaron con su tiempo terminal; esto evita mejorar artificialmente la mediana descartando errores.
- Los registros exportados no contienen JWT, cookies ni valores financieros del usuario.

## Resultado pareado

Segundos; cada celda muestra la mediana de tres corridas.

| Caso | UI útil antes | UI útil después | UI final antes | UI final después | Correctas antes/después |
|---|---:|---:|---:|---:|---:|
| Saldo | 6.89 | 3.54 | 7.06 | 10.41 | 3/3 → 3/3 |
| Movimientos | 9.55 | 3.02 | 9.73 | 8.55 | 3/3 → 3/3 |
| Comparación | 14.57 | 3.36 | 14.76 | 12.85 | 3/3 → 3/3 |
| Explicación con evidencia | sin cierre (0/3); terminal 37.99 | 5.39 | 37.99 | 15.88 | 0/3 → 3/3 |
| Seguimiento dinámico | 12.84 | 5.47 | 13.24 | 15.68 | 3/3 → 3/3 |

## Gate

| Indicador global | Antes | Después | Cambio |
|---|---:|---:|---:|
| Mediana de primera UI útil | 12.76 s | 3.75 s | −9.01 s (−70.6 %) |
| Peor primera UI útil | 38.35 s | 5.76 s | −32.59 s (−85.0 %) |
| Mediana de UI final | 13.15 s | 12.66 s | −0.49 s (−3.7 %) |
| Peor UI final | 38.35 s | 17.24 s | −21.11 s (−55.0 %) |
| Corridas completas | 12/15 | 15/15 | +3 |

Se supera el objetivo de 20 % para primera UI útil. La mediana y el peor caso finales no retroceden; ambos mejoran. En las 15 corridas posteriores hubo HTTP 200, cierre coherente de revisión, cero errores de datos/UI patches y cero errores del agente.

La variación por caso de la UI final sigue dependiendo de la latencia del modelo: saldo y seguimiento tuvieron medianas finales mayores que su muestra base, pero el agregado global y el peor caso mejoraron. No se redujeron filas, fuentes, llamadas MCP, validaciones ni contenido para obtener la mejora.

## Cambio validado

Cuando llegan fuentes suficientes, el backend forma una composición temprana con el mismo DSL dinámico, el adaptador de contrato y el validador semántico usados por el flujo final. Si la petición compara periodos y exige movimientos, combina métricas, gráfica/tabla por categoría y la tabla de evidencia. Gemini continúa y actualiza esa UI mediante patches hasta la composición final.
