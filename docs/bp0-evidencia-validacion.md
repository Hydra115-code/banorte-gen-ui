# BP0 — Evidencia de alcance de banca personal

Fecha de validación: 12 de septiembre de 2026.

## Resultado

BP0 queda cerrada. La experiencia presentada se limita a banca personal en la
superficie de usuario y en la política efectiva del agente. Los módulos de
pagos y educación permanecen en el código y conservan sus pruebas, pero no se
entregan al modelo ni se publican como recorridos del producto.

## Cambios comprobados

### Backend

- Se añadió `FINANCIAL_EXPERIENCE_SCOPE=personal_banking`, con valor seguro por
  defecto y opción `full` para conservar compatibilidad fuera de la demo.
- En modo banca personal, el modelo sólo recibe siete herramientas READ:
  `get_accounts`, `get_transactions`, `get_financial_summary`,
  `get_spending_by_category`, `get_cashflow`, `compare_periods` y
  `detect_transaction_anomalies`.
- Pagos, beneficiarios, estado de pagos, salud financiera, préstamo y ahorro
  quedan fuera del catálogo entregado al modelo.
- Las consultas de verticales ocultas se detienen antes de listar herramientas,
  ejecutar Gemini o generar UI con el planner.
- El prompt de sistema describe únicamente banca personal y ya no instruye al
  agente sobre pagos o simuladores cuando el modo está activo.
- La política reconoce formulaciones naturales necesarias para el recorrido,
  incluyendo «ahorré», comparaciones por mes, exclusión de compras y análisis
  de restaurantes.

### Frontend

- Encabezado, título, estado vacío, ejemplos y placeholder se reescribieron
  para cuentas, movimientos, comparaciones y gastos.
- El estado del sistema se conserva únicamente en desarrollo.
- Los harnesses dev devuelven 404 en producción.
- Al hidratar la pestaña se descartan sesiones heredadas cuyo título pertenece
  explícitamente a pagos, transferencias, crédito, préstamo o educación; las
  sesiones de banca personal se conservan.

## Pruebas vivas

| Caso | Resultado visible | Evidencia de servidor |
| --- | --- | --- |
| «¿Por qué ahorré menos este mes aunque gané lo mismo?» | Comparación julio-agosto con ingresos, gastos, flujo, categorías y UI generada | Correlación `88c39e85-30cb-4df4-aab7-6df90cb53779`; herramientas `get_accounts` y dos comparaciones `compare_periods`; ninguna herramienta oculta |
| «Prepara un pago de 500 MXN a un beneficiario» | Aviso informativo que redirige a cuentas, movimientos y gastos | Correlación `a47cf2d3-5963-4479-ab37-7d9df87ab335`; razón `product-scope`; `toolCallCount: 0`; sin decisión de modelo |
| «Evalúa mi salud financiera y dame una meta de ahorro» | El mismo límite de producto, sin formulario ni diagnóstico | Correlación `14e4ee59-f674-4f44-86cc-64f07aec4342`; razón `product-scope`; `toolCallCount: 0`; sin decisión de modelo |
| Build de producción `/` | Portada limpia de banca personal, sin indicadores técnicos | Inspección visual en puerto temporal 3002 |
| Build de producción `/dev/payment-safety-harness` | 404 | Inspección visual en puerto temporal 3002 |

El primer intento de la pregunta bancaria reveló que «ahorré» no se reconocía;
se corrigió la política y se repitió exactamente la misma pregunta hasta
obtener datos y UI. La inspección también detectó y corrigió la restauración de
dos sesiones antiguas de pagos en la portada.

## Gates automáticos

- Backend: 94 de 94 pruebas pasan.
- Backend: typecheck y build pasan.
- Frontend: typecheck y build de producción pasan.
- Banca personal frontend: 10 de 10 pruebas pasan.
- Persistencia de sesión: 6 de 6 pruebas pasan.
- Fingerprint contractual compartido:
  `7dcd9760845160aa1915ecc5cf1707379f32afc990982499647a03296f453482`.

## Hallazgos que pertenecen a fases posteriores

Estos defectos no cambian el alcance de BP0, pero deben resolverse antes del
ensayo final:

1. **BP1 — verdad financiera:** la UI mostró `800%` para una tasa de ahorro que
   la respuesta textual reportó como 8%. Hay que unificar la unidad contractual
   del porcentaje y probar todos los valores esperados del seed.
2. **BP2/BP3 — calidad y composición:** la primera respuesta tardó 19.9 s y
   produjo una tabla de ocho categorías. Para una explicación inicial conviene
   mostrar conclusión, dos causas y evidencia breve; el detalle debe aparecer
   bajo demanda.
3. **BP3 — herramienta correcta:** la consulta ejecutó `get_accounts` y dos
   comparaciones. Debe comprobarse si la cuenta era realmente ambigua y evitar
   llamadas que no aporten a la respuesta.
4. **BP4 — layout:** el compositor flotante cubre parte del contenido y de la
   nota legal durante el desplazamiento. Requiere espacio inferior reservado y
   prueba en la resolución de presentación.
5. **BP4 — lenguaje:** la UI generada todavía puede mostrar estructuras densas
   o etiquetas internas en fallbacks; deben traducirse y simplificarse.
6. **BP4 — rechazo útil:** el aviso de fuera de alcance puede ofrecer acciones
   directas como «Ver mis cuentas» o «Comparar mis gastos» para recuperar la
   conversación sin dejar al usuario en un callejón sin salida.
