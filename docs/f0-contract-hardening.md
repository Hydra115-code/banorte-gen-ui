# F0 — Cierre de contratos canónicos en frontend

Fecha de validación: 2026-09-11

## Alcance cerrado

- El frontend consume exclusivamente el entrypoint raíz de `@banorte/contracts`.
- Frontend y backend conservan copias idénticas del paquete común; el backend no fue modificado.
- Los eventos canónicos con `version` se validan siempre como contrato v1 y nunca degradan silenciosamente al adaptador legado.
- Una versión distinta de `1` produce `contract_version_unsupported`.
- Cada stream canónico mantiene su propio cursor y rechaza `sequence` duplicado o regresivo mediante `agent_stream_sequence_invalid`.
- Los errores del protocolo llegan al cliente como `data-agentError`, con código, mensaje, recuperabilidad y `correlationId`.
- El adaptador legado permanece aislado y sólo acepta eventos que no declaran `version`.

## Fixtures frontend-only

Se agregaron fixtures deterministas para:

1. banca personal;
2. educación financiera;
3. preparación y revisión de pagos.

El fixture de pagos no simula ejecución, confirmación ni comprobante. Esas capacidades siguen reservadas para la fase de integración, cuando existan contratos y herramientas de backend.

El catálogo cubre los 33 tipos de nodo del contrato actual y los cinco tipos de UI Patch: `update`, `add`, `replace`, `move` y `remove`.

Durante desarrollo puede revisarse en `/dev/contract-harness`. La ruta responde 404 en producción y no requiere backend.

## Gates ejecutables

- `pnpm contracts:verify`
- `pnpm protocol:verify`
- `pnpm fixtures:verify`
- `pnpm state-machine:verify`
- `pnpm build`

## Validación realizada

- 3 pruebas de compatibilidad contractual existentes;
- 5 pruebas nuevas de versión y secuencia de stream;
- 4 pruebas nuevas de fixtures, cobertura de nodos y patches;
- 8 pruebas de regresión de la máquina de estados;
- typecheck estricto;
- build de producción;
- revisión visual local del harness sin levantar el backend.

## Límite de responsabilidad

Los fixtures son representaciones frontend conformes al contrato compartido. Sustituirlos por capturas exportadas por el backend corresponde a la fase de integración y requiere que el backend publique dichos fixtures; no es un pendiente de implementación autónoma del frontend.
