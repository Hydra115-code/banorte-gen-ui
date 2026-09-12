import type { DataPatch, DataRegistryValue, UIPatch, UISpecification } from "@banorte/contracts";

export const educationInitialData: DataRegistryValue = {
  monthlyIncome: 32000,
  fixedExpenses: 22400,
  flexibleExpenses: 7700,
  currentMonthlySaving: 900,
  currentSavingsRate: 0.028,
  recommendedMonthlySaving: 2500,
  projectedSavings: 36000,
  goalProgress: 48,
};

export const educationInitialSpecification: UISpecification = {
  version: "1",
  root: {
    type: "container",
    id: "education-flow-root",
    size: "lg",
    padding: "md",
    children: [
      {
        type: "stack",
        id: "education-flow-stack",
        gap: "lg",
        children: [
          { type: "heading", id: "education-conclusion", content: "Tus gastos flexibles dejan poco margen para ahorrar", level: 2, size: "title" },
          { type: "text", id: "education-summary", content: "Después de cubrir gastos fijos, la mayor oportunidad está en consumos ajustables. Mantener una aportación constante puede ayudarte más que recortes aislados.", tone: "secondary" },
          {
            type: "section",
            id: "education-real-data",
            ariaLabel: "Datos observados",
            surface: "primary",
            padding: "md",
            children: [
              { type: "badge", id: "education-real-badge", label: "Datos observados", semanticState: "status.info", emphasis: "strong" },
              { type: "heading", id: "education-diagnosis-title", content: "Diagnóstico de tu mes", level: 3, size: "section" },
              {
                type: "grid",
                id: "education-real-metrics",
                columns: 4,
                gap: "md",
                children: [
                  { type: "metric", id: "education-income", label: "Ingreso", valueBinding: "monthlyIncome", format: "currency", importance: "secondary" },
                  { type: "metric", id: "education-fixed", label: "Gastos fijos", valueBinding: "fixedExpenses", format: "currency", importance: "secondary" },
                  { type: "metric", id: "education-flexible", label: "Gastos flexibles", valueBinding: "flexibleExpenses", format: "currency", importance: "secondary", semanticState: "financial.warning" },
                  { type: "metric", id: "education-current-rate", label: "Tasa de ahorro actual", valueBinding: "currentSavingsRate", format: "percent", importance: "secondary" },
                ],
              },
              {
                type: "accordion",
                id: "education-evidence",
                mode: "single",
                items: [
                  {
                    value: "evidence",
                    label: "Ver evidencia y explicación",
                    children: [
                      { type: "text", id: "education-period", content: "Periodo consultado: del 1 al 31 de agosto de 2026.", variant: "caption", tone: "secondary" },
                      { type: "list", id: "education-evidence-list", items: [
                        { label: "Gastos fijos: $22,400", supportingText: "Renta, transporte y servicios identificados como compromisos recurrentes." },
                        { label: "Gastos flexibles: $7,700", supportingText: "Alimentos fuera de casa, entretenimiento y compras no recurrentes." },
                        { label: "Ahorro observado: $900", supportingText: "Equivale a 2.8% del ingreso del periodo analizado." },
                      ] },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "split",
            id: "education-decision-split",
            ratio: "equal",
            collapseAt: "md",
            gap: "lg",
            children: [
              {
                type: "section",
                id: "education-simulation",
                ariaLabel: "Escenario simulado",
                surface: "secondary",
                padding: "md",
                children: [
                  { type: "badge", id: "education-simulation-badge", label: "Simulación", semanticState: "status.warning", emphasis: "strong" },
                  { type: "heading", id: "education-simulation-title", content: "Escenario de ahorro a 12 meses", level: 3, size: "section" },
                  { type: "alert", id: "education-simulation-disclaimer", title: "Resultado orientativo", message: "Esta simulación es orientativa y no constituye una oferta financiera.", semanticState: "status.warning" },
                  { type: "slider", id: "education-monthly-saving", label: "Aportación mensual", event: "savings.monthly.changed", min: 500, max: 5000, step: 100, initialValue: 2500, showValue: true, helpText: "El valor cambia localmente; el resultado se reconcilia al soltar." },
                  { type: "metric", id: "education-projected", label: "Ahorro proyectado", valueBinding: "projectedSavings", format: "currency", importance: "primary", semanticState: "financial.positive" },
                  { type: "progress", id: "education-goal-progress", label: "Avance de tu meta", valueBinding: "goalProgress", showValue: true, semanticState: "status.info" },
                ],
              },
              {
                type: "section",
                id: "education-recommendation",
                ariaLabel: "Recomendación priorizada",
                surface: "elevated",
                padding: "md",
                children: [
                  { type: "badge", id: "education-recommendation-badge", label: "Recomendación", semanticState: "status.success", emphasis: "strong" },
                  { type: "heading", id: "education-recommendation-title", content: "Empieza por dos gastos flexibles", level: 3, size: "section" },
                  { type: "list", id: "education-recommendation-list", ordered: true, items: [
                    { label: "Define un tope semanal para comidas fuera", supportingText: "Meta sugerida: liberar $1,000 al mes." },
                    { label: "Pausa una compra no esencial", supportingText: "Meta sugerida: liberar $600 al mes." },
                    { label: "Automatiza la aportación", supportingText: "Transfiere el monto elegido al inicio del periodo." },
                  ] },
                  { type: "button", id: "education-next-action", label: "Ajustar escenario", event: "education.scenario.adjust_requested", variant: "primary", helpText: "Revisa primero el escenario; ninguna operación se ejecuta desde aquí." },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const educationRestrictionUIPatches: readonly UIPatch[] = [
  {
    version: "1",
    baseRevision: 0,
    revision: 1,
    op: "update",
    target: "education-recommendation-title",
    changes: { content: "Conserva renta y transporte; ajusta sólo gastos flexibles" },
  },
  {
    version: "1",
    baseRevision: 1,
    revision: 2,
    op: "replace",
    target: "education-recommendation-list",
    node: {
      type: "list",
      id: "education-recommendation-list",
      ordered: true,
      items: [
        { label: "Mantén renta y transporte sin cambios", supportingText: "Restricción indicada por ti y aplicada al escenario." },
        { label: "Ajusta comidas fuera y entretenimiento", supportingText: "Meta combinada sugerida: liberar $1,100 al mes." },
        { label: "Empieza con una aportación de $2,000", supportingText: "Puedes modificarla sin comprometer tus gastos protegidos." },
      ],
    },
  },
  {
    version: "1",
    baseRevision: 2,
    revision: 3,
    op: "add",
    target: "education-simulation",
    index: 2,
    node: { type: "alert", id: "education-restriction-applied", title: "Restricciones aplicadas", message: "Renta y transporte permanecen sin cambios en este escenario.", semanticState: "status.info" },
  },
  {
    version: "1",
    baseRevision: 3,
    revision: 4,
    op: "update",
    target: "education-monthly-saving",
    changes: { initialValue: 2000 },
  },
];

export const educationRestrictionDataPatches: readonly DataPatch[] = [
  { version: "1", baseRevision: 0, revision: 1, op: "update", key: "recommendedMonthlySaving", value: 2000 },
  { version: "1", baseRevision: 1, revision: 2, op: "update", key: "projectedSavings", value: 30400 },
  { version: "1", baseRevision: 2, revision: 3, op: "update", key: "goalProgress", value: 41 },
];

export const educationSliderReconciliationPatch: DataPatch = {
  version: "1",
  baseRevision: 3,
  revision: 4,
  op: "update",
  key: "projectedSavings",
  value: 32800,
};

export const educationSliderReconciliationUIPatch: UIPatch = {
  version: "1",
  baseRevision: 4,
  revision: 5,
  op: "update",
  target: "education-monthly-saving",
  changes: { initialValue: 2200 },
};

export const educationFlowPrompts = [
  "Explícame por qué no logro ahorrar.",
  "No puedo reducir renta ni transporte.",
  "Ajusté mi aportación mensual.",
] as const;
