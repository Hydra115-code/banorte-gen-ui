# I6 — Streaming real de Generative UI

Fecha: 2026-09-12  
Estado: **implementado y validado técnica y visualmente**

## Objetivo

Entregar información financiera útil antes de terminar la composición completa, usando el protocolo compartido existente y el adaptador de Vercel AI SDK. I6 no modifica el contrato común ni introduce un protocolo paralelo.

## Flujo implementado

```text
PromptComposer
  → POST /api/agent con sesión HttpOnly
  → Agent API con JWT individual
  → Agent + MCP/Supabase
  → TextAgentStreamEvent NDJSON
  → adaptador Vercel AI SDK
  → DataPatch
  → UIStarted / UIPatch
  → UICompleted
  → AgentSessionProvider + DataRegistry + UIRenderer
```

El frontend consume los eventos tipados de progreso, datos, UI y error del contrato vigente. Cada `DataPatch` se aplica antes de renderizar el primer nodo que depende de esa fuente; los `UIPatch` respetan `baseRevision` y `revision`.

La ruta productiva `/api/agent` ahora exige la cookie de sesión, mantiene el JWT fuera del navegador y devuelve errores con `ErrorPayload` contractual. También conserva `correlationId` y `sessionId` en el stream y en cabeceras.

## Estados y métricas visibles

La experiencia distingue recuperación de datos, creación de interfaz, composición útil y resultado final. El panel de desarrollo registra:

- tiempo al primer evento;
- tiempo a los primeros datos;
- tiempo a la primera UI útil realmente pintada;
- tiempo total;
- latencias de Agent, MCP, planificación y render;
- cantidad de eventos, patches y renders;
- p50/p95 de aplicación de patch y patch a pintura.

## Prueba visual real

Harness: `/dev/streaming-ui-harness`. Renderiza el `AppShell` productivo; no contiene una `UISpecification` financiera fija.

Consulta: `¿Cuánto tengo disponible?`  
Correlación: `7ada4033-8604-4a8d-84fd-420edb5654f9`

| Hito | Tiempo |
| --- | ---: |
| Primer evento | 20 ms |
| Primeros datos | 2,156 ms |
| Primera UI útil pintada | 2,178.8 ms |
| Generación total del backend | 6,726 ms |
| Render inicial | 15.3 ms |
| Patch a pintura p95 | 54.9 ms |

Mientras el botón todavía mostraba `Cancelar consulta`, ya se veía la tabla provisional de tres cuentas con saldos formateados como moneda. La composición final sustituyó esa vista por métricas y detalle de cuentas. La información útil apareció aproximadamente **4.55 segundos antes** del resultado completo. No hubo errores ni advertencias en la consola del navegador.

## Defectos encontrados y corregidos

- La UI provisional mostraba importes y porcentajes como números crudos; el backend ahora infiere formatos `currency` y `percentage` y usa etiquetas financieras conocidas.
- Un fallback de salud financiera podía reemplazar indebidamente un resultado de gastos sólo porque esa fuente auxiliar existía; ahora se activa por intención semántica y los fallbacks de pago conservan prioridad.
- Se añadió la medición explícita de primer evento, que antes no podía distinguirse del inicio del agente.

## Verificación

- Frontend: `integration:streaming-ui:verify`, gate I5, todos los gates previos y `pnpm build` pasan.
- Backend: `pnpm typecheck`, `50/50` pruebas, challenge `5/5` y `pnpm build` pasan.
- Prueba dedicada backend: el primer `DataPatch` precede a la UI dependiente, existe al menos un `UIPatch` antes de `UICompleted` y los formatos provisionales son correctos.
- Los servicios de prueba fueron detenidos al terminar.

## Gate de salida

**Aprobado técnicamente:** existe información útil visible antes de completar toda la respuesta y la composición final mantiene contrato, identidad y revisiones. I7 no debe comenzar hasta la aceptación humana de I6.
