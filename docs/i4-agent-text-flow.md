# I4 — Prompt → Agent → MCP → texto

Fecha de verificación: 2026-09-12  
Estado: **frontend implementado y validado; I4 bloqueada por dos comportamientos del backend**  
Siguiente fase permitida: **ninguna**. I5 no debe comenzar hasta corregir y repetir los dos casos bloqueados.

## Alcance implementado en frontend

- El harness de desarrollo usa `useChat` y `DefaultChatTransport` de Vercel AI SDK.
- La ruta server-side exige la cookie HttpOnly creada en I3 y propaga el JWT individual al Agent API.
- Cada solicitud conserva el mismo `sessionId` y `correlationId` desde el navegador hasta los eventos contractuales del backend.
- El transporte valida que ningún evento del stream cambie esas identidades.
- El Agent API se consume como NDJSON con timeout de 45 segundos y clasificación separada para cancelación, timeout y caída de transporte.
- El checkpoint sólo entrega texto y evidencia temporal. No monta `UIRenderer`, no interpreta una especificación y descarta cualquier evento UI recibido.
- Cancelar detiene inmediatamente `useChat`, el stream de Next y el fetch server-side mediante una señal registrada para la solicitud exacta.

## Flujo probado

```text
PromptComposer temporal
  → Vercel AI SDK (useChat)
  → POST /api/integration/agent-text
  → cookie HttpOnly / JWT individual
  → POST backend /api/agent (responseMode=text)
  → Agent
  → MCP
  → Supabase
  → TextAgentStreamEvent NDJSON
  → stream textual de Vercel AI SDK
  → respuesta React temporal
```

## Evidencia real

### Caso aprobado: saldo disponible

Prompt: `¿Cuánto tengo disponible?`

- Correlation ID: `6ff55bcd-4630-4ad1-8b6b-1d924f1917b3`.
- El backend ejecutó MCP `get_accounts` y consultó Supabase.
- El frontend recibió un resultado MCP y un fragmento textual.
- La respuesta mostró los tres saldos reales del seed y calculó `$40,499.00 MXN` en depósitos.
- El backend también envió un evento UI; la frontera I4 lo contó y descartó. No se renderizó GenUI en esta fase.

### Autenticación aprobada

Una petición válida sin cookie respondió `401 authentication_required` y conservó el correlation ID enviado. No se llamó al agente.

### Identidad, timeout y errores aprobados

El gate automatizado comprueba:

- rechazo no recuperable cuando un evento cambia `sessionId` o `correlationId`;
- timeout independiente de 45 segundos;
- distinción entre cancelación del usuario, timeout y transporte no disponible;
- ausencia de escritura de `data-ui` o uso del `UIRenderer` en este checkpoint.

## Bloqueos reproducibles del backend

### 1. El prompt obligatorio de gastos se rechaza

Prompt exacto: `¿En qué gasté más este mes?`

Resultado real:

- cero llamadas MCP;
- respuesta de fuera de alcance: `Solo puedo ayudar con banca y finanzas personales...`;
- un evento UI impropio de `responseMode=text`, descartado por el frontend.

La causa está en `src/agent/security/financial-scope-policy.ts`: el clasificador reconoce `gasto` y `gastos`, pero la normalización convierte `gasté` en `gaste`, variante no incluida. El frontend no reescribe silenciosamente lo que el usuario pregunta porque cambiaría la entrada auditada.

### 2. El backend no observa la desconexión como cancelación

Prueba con correlation ID `72e2bc8c-ea41-4913-8060-e5363867831f`:

- el navegador solicitó cancelar;
- la ruta frontend aceptó la cancelación con `DELETE 202` y cerró su POST en aproximadamente 0.7 segundos;
- el backend siguió ejecutando Gemini, MCP y Supabase;
- al terminar registró `aborted:false` después de aproximadamente 4.65 segundos.

La ruta backend sólo enlaza el controlador a `request.once("aborted")`. Cerrar la respuesta/fetch desde Next no dispara ese evento para una petición cuyo body ya fue recibido. No existe un endpoint contractual para cancelar por `sessionId` y `correlationId`.

## Condición para cerrar I4

Sin tocar el frontend ya validado, el backend deberá:

1. aceptar la forma normalizada `gaste` como intención financiera y demostrar que el prompt obligatorio invoca MCP con datos reales;
2. cancelar la ejecución cuando el consumidor cierra la respuesta, o exponer un endpoint contractual de cancelación, y demostrar `aborted:true` sin continuar llamadas costosas;
3. respetar `responseMode=text` sin generar eventos UI;
4. repetir ambos prompts, cancelación, 401, timeout e identidad con los mismos gates.

Hasta entonces I4 no está al 100% y no se autoriza I5.
