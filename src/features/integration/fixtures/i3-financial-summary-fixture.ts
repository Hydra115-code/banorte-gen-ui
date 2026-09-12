import { uiSpecificationSchema } from "@banorte/contracts";

// Fixture fijo y exclusivo del checkpoint I3. No se usa en la experiencia productiva.
export const i3FinancialSummarySpecification = uiSpecificationSchema.parse({
  version: "1",
  root: {
    type: "section",
    id: "i3-financial-summary",
    ariaLabel: "Resultado real de la prueba de integración I3",
    children: [
      {
        type: "heading",
        id: "i3-summary-title",
        content: "Datos contractuales recibidos",
        level: 2,
      },
      {
        type: "metric",
        id: "i3-income",
        label: "Ingresos del periodo",
        valueBinding: "financialSummary.summaries.0.totalIncome",
        format: "currency",
        valueType: "string",
        importance: "primary",
        semanticState: "financial.positive",
      },
      {
        type: "metric",
        id: "i3-expenses",
        label: "Gastos del periodo",
        valueBinding: "financialSummary.summaries.0.totalExpenses",
        format: "currency",
        valueType: "string",
        importance: "secondary",
        semanticState: "financial.negative",
      },
      {
        type: "metric",
        id: "i3-cash-flow",
        label: "Flujo neto",
        valueBinding: "financialSummary.summaries.0.netCashFlow",
        format: "currency",
        valueType: "string",
        importance: "secondary",
        semanticState: "financial.neutral",
      },
    ],
  },
});
