# F9 — Seguridad, accesibilidad y pruebas

Estado: alcance frontend aislado completo; E2E autoritativo pendiente de integración.

## Seguridad

- Los diagnósticos, métricas internas y correlation IDs sólo se muestran en desarrollo.
- La CSP de producción impide scripts inline, atributos ejecutables, objetos y frames externos.
- El endpoint frontend limita el cuerpo a 16 KiB reales, alineado con el backend actual y medido en bytes UTF-8.
- Las respuestas del agente nunca se renderizan como HTML, JSX, CSS o JavaScript.
- Los snapshots financieros continúan restringidos a `sessionStorage`; no se usa `localStorage`.
- Cuentas y tarjetas se enmascaran antes de llegar a métricas, tablas o visualizaciones.
- Errores de sesión expirada, saldo insuficiente, duplicado y conflicto desactivan reintentos inseguros.

## Accesibilidad

- Auditor contractual automático para IDs, nombres accesibles, etiquetas y estados iniciales válidos.
- Las tres verticales pasan el auditor sin incidencias.
- Los errores financieros usan `role="alert"` y anuncios asertivos; información normal usa estado cortés.
- Los errores de sesión reciben foco programático sin desplazar la interfaz.
- Tabs, acordeones, controles, tablas y regiones desplazables mantienen navegación por teclado.
- Las gráficas conservan su tabla alternativa accesible y las animaciones respetan reducción de movimiento.

## Cobertura

- Gate `quality:verify` para seguridad, accesibilidad, errores financieros y los cinco tipos de UI Patch.
- Gates específicos existentes para contratos, streams, sesión, runtime, UI dinámica, interacción, banca, educación, pagos y continuidad.
- Harness visual `/dev/quality-gate-harness` con banca personal, educación financiera, error recuperable de pago y degradación de payload ejecutable.

## Pendiente de integración

- E2E con datos y eventos reales del backend para las tres verticales.
- E2E de autenticación expirada y resultado autoritativo de pagos cuando existan sus contratos.
- Confirmación y comprobante no pueden recibir gestión de foco hasta que sean estados contractuales reales.

El backend no fue modificado ni ejecutado durante esta fase.
