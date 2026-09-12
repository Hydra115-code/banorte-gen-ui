# Integration I5 — Primera Generative UI end-to-end

Fecha de validación: 2026-09-12  
Estado técnico: aprobado  
Entrega de UI: completa y atómica; sin streaming incremental al navegador

## Flujo implementado

```text
Usuario
  → PromptComposer temporal
  → POST /api/integration/agent-ui (Next.js + Vercel AI SDK)
  → JWT individual desde cookie HttpOnly
  → POST backend /api/agent
  → Agent → MCP → Supabase
  → UI Planner
  → DataPatch/UIPatch contractuales
  → colector y validación de revisión en Next.js
  → un único data-ui completo
  → UIRenderer
```

El backend puede producir patches durante el trabajo, pero la ruta I5 los aplica en memoria y sólo entrega al navegador la `UISpecification` final cuando recibió `ui-completed` con la misma revisión. Esto mantiene el límite de I5: todavía no existe construcción incremental visible.

## Cambios del frontend

- Se agregó `/api/integration/agent-ui`, autenticado con la sesión server-side ya creada en I3.
- `streamPlannedAgent` puede propagar el JWT individual sin exponerlo al navegador.
- `CompleteUICollector` aplica y valida `DataPatch` y `UIPatch`, exige una revisión final consistente y genera evidencia del payload completo.
- El stream de Vercel AI SDK entrega texto/estado y exactamente un `data-ui` validado al terminar.
- El harness `/dev/agent-ui-harness` ejecuta preguntas libres o los tres escenarios del gate. No contiene ninguna `UISpecification` financiera preconstruida.
- El panel de debugging registra prompt, IDs de sesión/correlación, data keys, firma de composición, resultado de validación, resultado de render y la especificación final.
- Se migró la cuadrícula de ECharts 6 de `containLabel` a `outerBounds`, eliminando la advertencia deprecada sin alterar los datos o el contrato.

## Ajuste mínimo del backend detectado por la prueba

El adaptador contractual normaliza porcentajes de `0..100` a `0..1`. El fallback educativo enlazaba `health.score` ya normalizado con formato `number` y etiqueta `Puntuación (0-100)`, por lo que mostraba `0.36`. Se corrigió a `Puntuación financiera` con formato `percentage`; ahora el renderer muestra `36%`, coherente con el diagnóstico `36/100`. Se agregó una aserción de regresión al test del fallback.

No se cambiaron contratos compartidos, servicios financieros, herramientas MCP ni operaciones de pago.

## Evidencia visual y de datos reales

| Prompt | Correlation ID | Herramientas MCP observadas en backend | UI final | Datos visibles | Tiempo backend |
| --- | --- | --- | --- | --- | --- |
| `¿Cuánto tengo disponible?` | `ce77c68f-e890-47ec-8800-32feb6888e67` | `get_accounts` | `flex`, 9 nodos | principal `$22,499.00`, ahorro `$18,000.00`, crédito `$8,400.00`; depósitos `$40,499.00` | 7,084 ms |
| `¿En qué se me está yendo el dinero?` | `bc120574-1b8e-40a1-93e0-3437cf88614e` | `get_accounts`, `get_spending_by_category`, `get_financial_summary` | `section`, 11 nodos; métricas, gráfica, tabla y recomendación | gastos `$27,601.00`, ingresos `$30,000.00`, flujo `$2,399.00`, tasa 8% | 15,430 ms |
| `Explícame por qué no logro ahorrar.` | `04f71972-e606-4c13-a252-e75e87f94376` | `get_accounts`, `evaluate_financial_health`, `get_spending_by_category` | `section`, 6 nodos; tarjeta educativa de salud | puntuación 36%, saldo líquido `$40,499.00`, margen `$5,637.25`, ahorro 25.1% | 16,494 ms |

El harness calculó `3/3` firmas de composición distintas. Los tres payloads terminaron con validación `valid`, render `montado` e identidad de sesión/correlación consistente. La consola limpia sólo registró React DevTools y la conexión HMR; no hubo errores ni advertencias de render.

Los nombres de herramientas se verifican en los logs correlacionados del backend. El contrato HTTP actual no expone nombres de herramientas al navegador; el frontend muestra correctamente el número de patches y no lo presenta como número de resultados MCP.

## Pruebas ejecutadas

Frontend:

- `pnpm integration:agent-ui:verify`: aprobado.
- Los otros 18 gates existentes: aprobados.
- `pnpm build`: aprobado, incluida `/api/integration/agent-ui` y `/dev/agent-ui-harness`.
- Recorrido visual real de los tres prompts: aprobado; `3/3` composiciones distintas.

Backend:

- `pnpm typecheck`: aprobado.
- `node --import tsx --test tests/*.test.ts`: 47/47 aprobadas.
- `pnpm test:challenge`: 5/5 aprobadas.
- `pnpm build`: aprobado.

## Gate de salida

I5 cumple el gate técnico: las tres consultas producen interfaces válidas, distintas, renderizables y basadas en datos reales de MCP/Supabase. I6 continúa bloqueada hasta la aceptación humana de este resultado.

La latencia total observada (7.1–16.5 s) sigue siendo alta. No se ocultó con estado financiero optimista ni se adelantó el streaming visible: será una entrada explícita para las fases de streaming y rendimiento.
