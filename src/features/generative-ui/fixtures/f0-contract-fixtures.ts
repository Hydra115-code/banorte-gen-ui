import type { DataRegistryValue, UISpecification, UIPatch } from "@banorte/contracts";

export interface ContractFixture {
  id: "personal-banking" | "financial-education" | "payment-preparation";
  label: string;
  specification: UISpecification;
  data: DataRegistryValue;
}

export const personalBankingFixture: ContractFixture = {
  id: "personal-banking",
  label: "Banca personal",
  data: {
    balance: 42850.75,
    accountNumber: "012345678901234567",
    monthlyChange: 0.084,
    budgetProgress: 64,
    showNotice: true,
    categories: [
      { category: "Hogar", amount: 8500 },
      { category: "Alimentos", amount: 4200 },
      { category: "Transporte", amount: 2100 },
    ],
    transactions: [
      { id: "tx-001", date: "2026-09-10", description: "Supermercado", amount: -1240.5, status: "Aplicado" },
      { id: "tx-002", date: "2026-09-09", description: "Nómina", amount: 28500, status: "Aplicado" },
    ],
  },
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "personal-root",
      ariaLabel: "Resumen de banca personal",
      surface: "primary",
      padding: "md",
      children: [
        { type: "heading", id: "personal-title", content: "Tu dinero hoy", level: 2, size: "title" },
        { type: "text", id: "personal-subtitle", content: "Información de demostración para validar el contrato visual.", tone: "secondary" },
        {
          type: "grid",
          id: "personal-metrics",
          columns: 2,
          gap: "md",
          children: [
            { type: "metric", id: "balance-metric", label: "Saldo total", valueBinding: "balance", format: "currency", importance: "primary", semanticState: "financial.neutral" },
            { type: "metric", id: "change-metric", label: "Cambio mensual", valueBinding: "monthlyChange", format: "percent", trendBinding: "monthlyChange", semanticState: "financial.positive" },
            { type: "metric", id: "account-metric", label: "Cuenta", valueBinding: "accountNumber", format: "text", importance: "tertiary" },
          ],
        },
        { type: "progress", id: "budget-progress", label: "Presupuesto utilizado", valueBinding: "budgetProgress", showValue: true, semanticState: "status.info" },
        {
          type: "visualization",
          id: "spending-chart",
          ariaLabel: "Gasto por categoría",
          description: "Distribución de gasto mensual",
          mark: "donut",
          dataBinding: "categories",
          encoding: {
            group: { field: "category", type: "nominal", label: "Categoría" },
            value: { field: "amount", type: "quantitative", label: "Monto" },
          },
          legend: { show: true, position: "bottom" },
        },
        {
          type: "table",
          id: "transactions-table",
          ariaLabel: "Movimientos recientes",
          caption: "Últimos movimientos de ejemplo",
          dataBinding: "transactions",
          columns: [
            { field: "date", label: "Fecha", format: "date", sortable: true },
            { field: "description", label: "Descripción", format: "text" },
            { field: "amount", label: "Monto", format: "currency", align: "end", sortable: true },
            { field: "status", label: "Estado", format: "status" },
          ],
          sorting: { enabled: true, default: { field: "date", direction: "descending" } },
          filtering: { enabled: true, fields: ["description", "status"], placeholder: "Buscar movimientos" },
          selection: { mode: "single", rowIdField: "id", event: "transaction.selection.changed" },
          density: "comfortable",
        },
        {
          type: "conditional",
          id: "personal-notice",
          condition: { binding: "showNotice", operator: "==", value: true },
          then: { type: "alert", id: "notice-visible", title: "Información", message: "Los montos de este fixture no representan datos reales.", semanticState: "status.info" },
          else: { type: "badge", id: "notice-hidden", label: "Sin avisos", semanticState: "status.success" },
        },
      ],
    },
  },
};

export const financialEducationFixture: ContractFixture = {
  id: "financial-education",
  label: "Educación financiera",
  data: {
    projectedSavings: 73500,
    goalProgress: 58,
    lessons: [
      { title: "Fondo de emergencia" },
      { title: "Interés compuesto" },
    ],
  },
  specification: {
    version: "1",
    root: {
      type: "container",
      id: "education-root",
      size: "lg",
      padding: "md",
      children: [
        {
          type: "stack",
          id: "education-stack",
          gap: "md",
          children: [
            { type: "heading", id: "education-title", content: "Simulador educativo de ahorro", level: 2 },
            { type: "alert", id: "simulation-alert", title: "Simulación", message: "Este resultado es orientativo y no constituye una oferta financiera.", semanticState: "status.warning" },
            {
              type: "split",
              id: "education-split",
              ratio: "sidebar-start",
              collapseAt: "md",
              gap: "lg",
              children: [
                {
                  type: "stack",
                  id: "education-controls",
                  gap: "sm",
                  children: [
                    { type: "slider", id: "monthly-saving", label: "Ahorro mensual", event: "savings.monthly.changed", min: 500, max: 10000, step: 500, initialValue: 2500, showValue: true },
                    { type: "numberInput", id: "saving-months", label: "Plazo en meses", event: "savings.term.changed", min: 1, max: 120, step: 1, initialValue: 24, required: true },
                    { type: "select", id: "saving-profile", label: "Perfil", event: "savings.profile.changed", options: [{ value: "conservative", label: "Conservador" }, { value: "balanced", label: "Balanceado" }], initialValue: "balanced" },
                  ],
                },
                {
                  type: "stack",
                  id: "education-result",
                  gap: "sm",
                  children: [
                    { type: "metric", id: "projected-savings", label: "Ahorro proyectado", valueBinding: "projectedSavings", format: "currency", semanticState: "financial.positive" },
                    { type: "progress", id: "goal-progress", label: "Avance estimado de meta", valueBinding: "goalProgress", showValue: true, semanticState: "status.success" },
                    { type: "icon", id: "education-icon", name: "info", label: "Resultado informativo", semanticState: "status.info" },
                  ],
                },
              ],
            },
            {
              type: "accordion",
              id: "education-accordion",
              mode: "single",
              defaultOpen: ["concepts"],
              items: [{ value: "concepts", label: "Conceptos clave", children: [{ type: "list", id: "education-list", ordered: true, items: [{ label: "Define una meta alcanzable" }, { label: "Aporta de forma constante" }] }] }],
            },
            {
              type: "repeat",
              id: "lesson-repeat",
              dataBinding: "lessons",
              template: { type: "metric", id: "lesson-item", labelBinding: "$item.title", valueBinding: "$index", format: "number", fallback: 0 },
              empty: { type: "text", id: "lesson-empty", content: "No hay lecciones disponibles." },
            },
          ],
        },
      ],
    },
  },
};

export const paymentPreparationFixture: ContractFixture = {
  id: "payment-preparation",
  label: "Preparación de pagos",
  data: { paymentSteps: ["Captura", "Revisión", "Confirmación externa"] },
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "payment-root",
      ariaLabel: "Preparación de un pago",
      surface: "elevated",
      padding: "md",
      children: [
        { type: "heading", id: "payment-title", content: "Preparar pago", level: 2 },
        { type: "badge", id: "payment-scope", label: "Sólo revisión", semanticState: "status.warning", emphasis: "strong" },
        { type: "text", id: "payment-copy", content: "Este fixture valida captura y revisión; no ejecuta operaciones ni genera comprobantes." },
        { type: "divider", id: "payment-divider", strength: "subtle" },
        {
          type: "tabs",
          id: "payment-tabs",
          ariaLabel: "Tipo de pago",
          defaultValue: "transfer",
          items: [
            {
              value: "transfer",
              label: "Transferencia",
              children: [
                {
                  type: "flex",
                  id: "payment-fields",
                  direction: "column",
                  gap: "sm",
                  children: [
                    { type: "input", id: "recipient", label: "Beneficiario", event: "payment.recipient.changed", placeholder: "Nombre del beneficiario", validation: { required: true, minLength: 2, maxLength: 120 } },
                    { type: "numberInput", id: "payment-amount", label: "Monto", event: "payment.amount.changed", min: 0.01, max: 1000000, step: 0.01, required: true },
                    { type: "datePicker", id: "payment-date", label: "Fecha", event: "payment.date.changed", min: "2026-09-11", max: "2027-09-11", initialValue: "2026-09-11" },
                    { type: "dateRange", id: "payment-range", label: "Periodo de consulta", event: "payment.range.changed", min: "2026-01-01", max: "2026-12-31", initialValue: { start: "2026-09-01", end: "2026-09-11" } },
                    { type: "multiSelect", id: "payment-tags", label: "Etiquetas", event: "payment.tags.changed", options: [{ value: "services", label: "Servicios" }, { value: "frequent", label: "Frecuente" }], maxSelections: 2 },
                    { type: "radioGroup", id: "payment-speed", label: "Velocidad", event: "payment.speed.changed", options: [{ value: "standard", label: "Estándar" }, { value: "scheduled", label: "Programado" }], initialValue: "standard" },
                    { type: "checkbox", id: "payment-review", label: "Revisé los datos", event: "payment.review.changed", required: true },
                    { type: "switch", id: "payment-notification", label: "Avisarme cuando exista resultado", event: "payment.notification.changed", initialChecked: true },
                    { type: "button", id: "payment-review-button", label: "Revisar pago", event: "payment.review.requested", variant: "primary" },
                  ],
                },
              ],
            },
            { value: "service", label: "Servicio", children: [{ type: "text", id: "service-placeholder", content: "La integración de servicios requiere contrato de backend." }] },
          ],
        },
        {
          type: "scrollable",
          id: "payment-steps-scroll",
          ariaLabel: "Etapas del pago",
          axis: "horizontal",
          maxSize: "sm",
          children: [{ type: "list", id: "payment-steps", items: [{ label: "Captura" }, { label: "Revisión" }, { label: "Confirmación mediante backend" }] }],
        },
      ],
    },
  },
};

export const f0ContractFixtures = [
  personalBankingFixture,
  financialEducationFixture,
  paymentPreparationFixture,
] as const;

export const personalBankingPatchSequence: readonly UIPatch[] = [
  { version: "1", baseRevision: 0, revision: 1, op: "update", target: "personal-title", changes: { content: "Tu dinero este mes" } },
  { version: "1", baseRevision: 1, revision: 2, op: "add", target: "personal-root", node: { type: "badge", id: "fresh-data", label: "Datos actualizados", semanticState: "status.success" } },
  { version: "1", baseRevision: 2, revision: 3, op: "replace", target: "fresh-data", node: { type: "alert", id: "fresh-data-alert", message: "La información terminó de actualizarse.", semanticState: "status.success" } },
  { version: "1", baseRevision: 3, revision: 4, op: "move", target: "personal-subtitle", parent: "personal-metrics", index: 0 },
  { version: "1", baseRevision: 4, revision: 5, op: "remove", target: "fresh-data-alert" },
];
