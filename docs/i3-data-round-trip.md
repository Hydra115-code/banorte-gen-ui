# Integration I3 — Data Round Trip sin LLM

Estado: implementado y verificado; pendiente de validación humana antes de I4.

## Checkpoint cerrado

I3 demuestra el recorrido real:

```text
React
  → ruta server-side de Next
  → Backend protegido
  → MCP get_financial_summary
  → Supabase con RLS
  → respuesta contractual
  → DataRegistry
  → UIRenderer
```

No intervienen el Agent API, Gemini ni generación de UI. La UISpecification fija sólo existe en `/dev/integration-data-harness` y queda excluida de producción mediante `notFound()`.

## Identidad y aislamiento

- El usuario inicia sesión contra Supabase desde una ruta server-side.
- Next guarda access y refresh token en cookies `HttpOnly`, `SameSite=Strict`, `Path=/` y `Secure` en producción.
- La respuesta de login sólo contiene `authenticated` y `expiresAt`; no expone JWT, refresh token ni `userId`.
- El navegador no elige ni envía `userId`.
- La ruta de datos lee el JWT de la cookie y lo propaga como `Authorization: Bearer <JWT>`.
- Si el access token expira, la ruta intenta una rotación con el refresh token una sola vez; si falla, elimina ambas cookies.
- Un request sin sesión recibe `401 authentication_required` antes de consultar el backend.

## Contratos y seguridad del transporte

- Request y response usan los schemas canónicos `FinancialSummaryRequest` y `FinancialSummaryResponse`.
- La correlación de la respuesta debe coincidir con la solicitud.
- Request y response tienen límites de bytes, timeout y `Cache-Control: no-store`.
- El frontend no utiliza `AGENT_API_TOKEN`, `SUPABASE_ACCESS_TOKEN` ni una service-role key para este flujo.
- Los importes contractuales continúan siendo strings decimales; el formatter sólo acepta el patrón financiero permitido antes de mostrarlos como moneda.

## Evidencia real

Con el usuario sintético A y el periodo 2026-08-01 a 2026-08-31:

- autenticación Supabase: `200`;
- llamada frontend protegida sin cookie: `401 authentication_required`;
- backend: `200`;
- MCP ejecutó `get_financial_summary`;
- el span Supabase terminó con `success: true` y un resultado;
- el DataRegistry contractual llegó a React;
- la UISpecification fija mostró `$30,000.00` de ingresos, `$27,600.00` de gastos y `$2,400.00` de flujo neto;
- una sesión visual limpia terminó sin errores de consola.

Los valores son datos sintéticos del seed, no valores hardcodeados en la UISpecification.

## Gate dedicado

`pnpm integration:data:verify` cubre cinco pruebas distintas:

1. intercambio de credenciales con Supabase sin devolverlas en la sesión normalizada;
2. JWT individual y correlación enviados al backend;
3. rechazo de una respuesta con correlación distinta;
4. fixture contractual sin valores financieros hardcodeados y formato de importe decimal;
5. cookies HttpOnly estrictas y ausencia de `AGENT_API_TOKEN` en la ruta I3.

## Límite para I4

I3 no cambia `/api/agent` ni envía prompts. I4 deberá propagar esta misma identidad por el adaptador de Vercel AI SDK y comprobar únicamente Agent → MCP → texto antes de permitir UI generada.
