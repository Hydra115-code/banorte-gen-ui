# Integration I1 — Shared Contracts

Estado: completo en frontend; listo para validación antes de I2.

## Fuente canónica

- Backend: `/home/erk/Documentos/Moc-back/packages/contracts`.
- Backend baseline: `4093084b356a92559e9085d604078688077aef68`.
- Package: `@banorte/contracts@1.0.0`.
- Fingerprint: `d4a19c245e388c759fbcba6c9647090fc370bd668f6f8cf3ae9269cf7de0e792`.

El paquete contractual del frontend coincide byte por byte con el backend en fuentes, manifiesto, generador de fingerprint y pruebas públicas.

## Capacidades incorporadas

- `CONTRACT_FINGERPRINT` y validación estricta del handshake.
- `Account`, `Transaction`, `FinancialSummary` y `FinancialHealth`.
- `PaymentIntent`, `PaymentConfirmationRequest` y `PaymentReceipt`.
- Fixtures contractuales deterministas de request, stream, UI, Data Registry, UI Patch, UIEvent y pagos.
- Exports públicos y subpaths idénticos a la fuente canónica.

Estos contratos no crean pantallas ni componentes productivos. La UI continúa siendo una `UISpecification` generada y renderizada por el runtime GenUI.

## Gate bidireccional

`pnpm integration:contracts:verify` comprueba mediante serialización JSON real:

- fingerprint y versión idénticos;
- fixtures backend aceptados directamente por schemas frontend;
- `UIEvent` frontend aceptado directamente por el backend;
- `SystemStatus`, PaymentIntent, confirmación y comprobante sin adapters manuales.

## Regresión

- gate bidireccional: pasa;
- contratos frontend: pasan;
- protocolo de stream: pasa;
- gates F0–F10: pasan;
- typecheck: pasa;
- build de producción: pasa y genera 13 rutas.

## Fuera del alcance de I1

- login y propagación de JWT Supabase;
- levantar backend/frontend;
- handshake HTTP;
- llamada a MCP, Gemini o Supabase;
- habilitar ejecución de pagos.

Estos puntos comienzan en I2/I3 y no deben implementarse antes de validar I1.
