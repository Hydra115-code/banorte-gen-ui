# F5 — Experiencia de banca personal

Fecha de validación: 2026-09-12

## Resultado

F5 define cuatro composiciones frontend contractuales, una por intención obligatoria del plan. No convierte el inicio en un dashboard fijo y no depende del backend para su validación:

| Consulta | Composición |
| --- | --- |
| `¿Cuánto tengo disponible?` | Respuesta breve: saldo principal y cuenta enmascarada |
| `Muéstrame mis últimos movimientos.` | Controles de cuenta/periodo y tabla paginada localmente |
| `¿En qué gasté más este mes?` | Controles, métricas, gráfica por categoría y observación estadística |
| `Compáralo con el mes anterior y quita la tabla.` | Métricas y barras agrupadas; no contiene tabla |

## Reglas transversales

- cada composición muestra `Periodo consultado` y `Evidencia`;
- cuentas y productos sensibles se muestran enmascarados;
- las series declaran una sola cuenta y moneda, evitando comparaciones incompatibles;
- las anomalías se presentan como observaciones estadísticas, no como acusaciones de fraude;
- la paginación, filtro y orden de movimientos permanecen locales y no pierden la sesión;
- los controles que cambian cuenta, periodo o categoría emiten intents contractuales de F4;
- `PromptComposer` permanece junto al canvas para continuar cualquier análisis mediante texto.

Los valores son sintéticos y existen únicamente para validar el runtime frontend. La fuente autoritativa seguirá siendo el backend durante integración.

## Gates

- `pnpm banking:verify`;
- `/dev/personal-banking-harness`, galería visual de las cuatro intenciones;
- gates acumulados F0–F4 y build de producción.

El harness responde 404 en producción y no requiere backend.

## Límite de integración

El frontend ya puede consumir y representar las cuatro experiencias. Queda pendiente reproducirlas con datos/eventos reales emitidos por el backend y ejecutar E2E de refinamiento por texto y controles. F5 no calcula saldos oficiales ni mezcla datos de distintas cuentas o monedas.
