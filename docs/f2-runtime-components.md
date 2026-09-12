# F2 — Runtime seguro de componentes

Fecha de validación: 2026-09-11

## Alcance

F2 consolida el runtime del frontend sobre el UI DSL v1 existente. No agrega nodos fuera del contrato, no ejecuta código generado y no modifica el backend.

## Matriz contractual

La fuente verificable es `src/features/generative-ui/runtime/node-capability-matrix.ts`. El gate compara esta matriz directamente con los casos del renderer para impedir que un tipo contractual quede declarado pero no renderizado.

| Familia | Nodos | Binding | Eventos |
| --- | --- | --- | --- |
| Layout | `container`, `section`, `stack`, `grid`, `flex`, `split`, `scrollable`, `divider`, `tabs`, `accordion` | No requieren datos | Tabs, accordion y recuperación de secciones usan eventos locales |
| Contenido | `text`, `heading`, `metric`, `badge`, `alert`, `progress`, `icon`, `list` | `metric` y `progress` requieren binding | Sin eventos financieros |
| Datos | `visualization`, `table` | Binding requerido | Selección de tabla configurable; controles visuales locales |
| Controles | `button`, `input`, `numberInput`, `select`, `multiSelect`, `slider`, `datePicker`, `dateRange`, `checkbox`, `switch`, `radioGroup` | Estado inicial contractual | Evento configurable y tipado |
| Lógica | `repeat`, `conditional` | Binding requerido | Sin emisión directa |

Total: 33 tipos contractuales.

## Enmascaramiento financiero

La política detecta identificadores financieros por el último segmento del binding, incluyendo variantes en español e inglés de cuenta, tarjeta, PAN, CLABE e IBAN.

- Sólo se conservan los últimos cuatro caracteres.
- Identificadores de cuatro caracteres o menos se ocultan por completo.
- Campos cercanos pero no sensibles, como `accountType` o `amount`, no se alteran.
- La misma política se aplica a métricas/bindings, celdas de tabla, categorías y grupos de gráficas, tooltips derivados y tablas accesibles de visualización.
- El valor original continúa disponible únicamente para operaciones locales como ordenamiento o selección; nunca se inserta como texto visible.

## Validación del renderer

- Los fixtures de banca personal, educación financiera y preparación de pagos cubren los 33 nodos.
- El fixture de banca personal incluye una cuenta completa para comprobar visualmente que sólo aparece `•••• 4567`.
- `pnpm runtime:verify` valida unicidad, sincronía con el renderer, política de masking y sus cuatro consumidores.
- `pnpm fixtures:verify` mantiene la cobertura contractual y los cinco tipos de UI Patch.

## Límite de pagos

Los controles pueden capturar y revisar datos, pero el runtime no presenta ejecución ni comprobantes de pago. Esas capacidades requieren eventos contractuales del backend y permanecen para integración.
