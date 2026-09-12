import type { DataRegistryValue, UISpecification } from "@banorte/contracts";

export type PersonalBankingScenarioId = "available-balance" | "recent-transactions" | "monthly-spending" | "period-comparison";

export interface PersonalBankingScenario {
  id: PersonalBankingScenarioId;
  label: string;
  prompt: string;
  data: DataRegistryValue;
  specification: UISpecification;
  seriesScopes: readonly { binding: string; accountId: string; currency: string }[];
}

const accountOptions = [
  { value: "main", label: "Cuenta principal • 4567" },
  { value: "payroll", label: "Nómina • 9012" },
];

export const availableBalanceScenario: PersonalBankingScenario = {
  id: "available-balance",
  label: "Respuesta breve de saldo",
  prompt: "¿Cuánto tengo disponible?",
  data: {
    availableBalance: 42850.75,
    accountNumber: "012345678901234567",
  },
  seriesScopes: [],
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "available-root",
      ariaLabel: "Saldo disponible",
      surface: "primary",
      padding: "md",
      children: [
        { type: "heading", id: "available-title", content: "Tienes $42,850.75 disponibles", level: 2, size: "title" },
        { type: "text", id: "available-period", content: "Periodo consultado: saldo vigente al 12 de septiembre de 2026, 09:30.", variant: "caption", tone: "secondary" },
        { type: "text", id: "available-evidence", content: "Evidencia: saldo disponible reportado para la cuenta seleccionada; no incluye líneas de crédito.", variant: "caption", tone: "secondary" },
        {
          type: "grid",
          id: "available-metrics",
          columns: 2,
          gap: "md",
          children: [
            { type: "metric", id: "available-balance", label: "Disponible", valueBinding: "availableBalance", format: "currency", importance: "primary", semanticState: "financial.positive" },
            { type: "metric", id: "available-account", label: "Cuenta", valueBinding: "accountNumber", format: "text", importance: "tertiary" },
          ],
        },
      ],
    },
  },
};

const recentTransactions = [
  { id: "tx-101", date: "2026-09-12", description: "Farmacia", category: "Salud", amount: -486.2, accountId: "main", currency: "MXN" },
  { id: "tx-102", date: "2026-09-11", description: "Transferencia recibida", category: "Ingresos", amount: 3200, accountId: "main", currency: "MXN" },
  { id: "tx-103", date: "2026-09-10", description: "Supermercado", category: "Alimentos", amount: -1240.5, accountId: "main", currency: "MXN" },
  { id: "tx-104", date: "2026-09-09", description: "Nómina", category: "Ingresos", amount: 28500, accountId: "main", currency: "MXN" },
  { id: "tx-105", date: "2026-09-08", description: "Gasolina", category: "Transporte", amount: -980, accountId: "main", currency: "MXN" },
  { id: "tx-106", date: "2026-09-07", description: "Servicio de internet", category: "Servicios", amount: -649, accountId: "main", currency: "MXN" },
  { id: "tx-107", date: "2026-09-06", description: "Restaurante", category: "Alimentos", amount: -735, accountId: "main", currency: "MXN" },
  { id: "tx-108", date: "2026-09-05", description: "Plataforma digital", category: "Entretenimiento", amount: -219, accountId: "main", currency: "MXN" },
  { id: "tx-109", date: "2026-09-04", description: "Electricidad", category: "Servicios", amount: -1128.4, accountId: "main", currency: "MXN" },
  { id: "tx-110", date: "2026-09-03", description: "Cafetería", category: "Alimentos", amount: -164, accountId: "main", currency: "MXN" },
  { id: "tx-111", date: "2026-09-02", description: "Seguro de auto", category: "Protección", amount: -1580, accountId: "main", currency: "MXN" },
  { id: "tx-112", date: "2026-09-01", description: "Rendimiento", category: "Ingresos", amount: 94.2, accountId: "main", currency: "MXN" },
];

export const recentTransactionsScenario: PersonalBankingScenario = {
  id: "recent-transactions",
  label: "Movimientos paginados",
  prompt: "Muéstrame mis últimos movimientos.",
  data: {
    accountNumber: "012345678901234567",
    movements: recentTransactions,
  },
  seriesScopes: [{ binding: "movements", accountId: "main", currency: "MXN" }],
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "movements-root",
      ariaLabel: "Últimos movimientos",
      padding: "md",
      children: [
        { type: "heading", id: "movements-title", content: "Tus últimos movimientos", level: 2, size: "title" },
        { type: "text", id: "movements-period", content: "Periodo consultado: del 1 al 12 de septiembre de 2026.", variant: "caption", tone: "secondary" },
        { type: "text", id: "movements-evidence", content: "Evidencia: 12 movimientos contabilizados, ordenados de más reciente a más antiguo.", variant: "caption", tone: "secondary" },
        {
          type: "flex",
          id: "movements-controls",
          wrap: "wrap",
          gap: "sm",
          children: [
            { type: "select", id: "movements-account", label: "Cuenta", event: "account.selection.changed", options: accountOptions, initialValue: "main" },
            { type: "select", id: "movements-period-filter", label: "Periodo", event: "account.period.changed", options: [{ value: "12-days", label: "Últimos 12 días" }, { value: "month", label: "Este mes" }], initialValue: "12-days" },
          ],
        },
        { type: "metric", id: "movements-account-number", label: "Cuenta consultada", valueBinding: "accountNumber", format: "text", importance: "tertiary" },
        {
          type: "table",
          id: "movements-table",
          ariaLabel: "Movimientos de la cuenta principal",
          caption: "Importes en MXN · página local de 10 movimientos",
          dataBinding: "movements",
          columns: [
            { field: "date", label: "Fecha", format: "date", sortable: true },
            { field: "description", label: "Descripción", format: "text" },
            { field: "category", label: "Categoría", format: "text" },
            { field: "amount", label: "Monto", format: "currency", align: "end", sortable: true },
          ],
          sorting: { enabled: true, default: { field: "date", direction: "descending" } },
          filtering: { enabled: true, fields: ["description", "category"], placeholder: "Buscar en estos movimientos" },
          pagination: { pageSize: 10 },
          density: "comfortable",
          stickyHeader: true,
        },
      ],
    },
  },
};

const monthlyCategories = [
  { category: "Hogar", amount: 8500, accountId: "main", currency: "MXN", period: "2026-09" },
  { category: "Alimentos", amount: 4200, accountId: "main", currency: "MXN", period: "2026-09" },
  { category: "Transporte", amount: 2100, accountId: "main", currency: "MXN", period: "2026-09" },
  { category: "Servicios", amount: 1777.4, accountId: "main", currency: "MXN", period: "2026-09" },
  { category: "Entretenimiento", amount: 954, accountId: "main", currency: "MXN", period: "2026-09" },
];

export const monthlySpendingScenario: PersonalBankingScenario = {
  id: "monthly-spending",
  label: "Exploración de gasto",
  prompt: "¿En qué gasté más este mes?",
  data: {
    totalSpent: 17531.4,
    highestCategoryAmount: 8500,
    categoryShare: 0.485,
    categories: monthlyCategories,
  },
  seriesScopes: [{ binding: "categories", accountId: "main", currency: "MXN" }],
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "spending-root",
      ariaLabel: "Gasto mensual por categoría",
      surface: "primary",
      padding: "md",
      children: [
        { type: "heading", id: "spending-title", content: "Hogar fue tu categoría con mayor gasto", level: 2, size: "title" },
        { type: "text", id: "spending-period", content: "Periodo consultado: del 1 al 12 de septiembre de 2026.", variant: "caption", tone: "secondary" },
        { type: "text", id: "spending-evidence", content: "Evidencia: agrupación de cargos contabilizados por categoría en la cuenta principal, expresados en MXN.", variant: "caption", tone: "secondary" },
        {
          type: "flex",
          id: "spending-controls",
          wrap: "wrap",
          gap: "sm",
          children: [
            { type: "select", id: "spending-account", label: "Cuenta", event: "account.selection.changed", options: accountOptions, initialValue: "main" },
            { type: "select", id: "spending-period-filter", label: "Periodo", event: "account.period.changed", options: [{ value: "current", label: "Este mes" }, { value: "previous", label: "Mes anterior" }], initialValue: "current" },
            { type: "multiSelect", id: "spending-category-filter", label: "Categorías", event: "account.categories.changed", options: monthlyCategories.map(({ category }) => ({ value: category.toLowerCase(), label: category })), maxSelections: 5 },
          ],
        },
        {
          type: "grid",
          id: "spending-metrics",
          columns: 3,
          gap: "md",
          children: [
            { type: "metric", id: "spending-total", label: "Gasto analizado", valueBinding: "totalSpent", format: "currency", importance: "primary", semanticState: "financial.neutral" },
            { type: "metric", id: "spending-highest", label: "Hogar", valueBinding: "highestCategoryAmount", format: "currency", importance: "secondary", semanticState: "financial.warning" },
            { type: "metric", id: "spending-share", label: "Participación de Hogar", valueBinding: "categoryShare", format: "percent", importance: "tertiary" },
          ],
        },
        {
          type: "visualization",
          id: "spending-chart",
          ariaLabel: "Distribución del gasto por categoría",
          description: "Cargos contabilizados en la cuenta principal durante septiembre de 2026, en MXN.",
          mark: "donut",
          dataBinding: "categories",
          encoding: {
            group: { field: "category", type: "nominal", label: "Categoría" },
            value: { field: "amount", type: "quantitative", label: "Monto" },
          },
          legend: { show: true, position: "bottom" },
          sort: { by: "value", direction: "descending" },
          height: "md",
        },
        { type: "alert", id: "spending-observation", title: "Observación estadística", message: "Hogar concentra 48.5% del gasto observado. Esto describe el patrón de este periodo y no implica actividad irregular.", semanticState: "status.info" },
      ],
    },
  },
};

const comparisonCategories = [
  { category: "Hogar", amount: 8500, period: "Septiembre", accountId: "main", currency: "MXN" },
  { category: "Hogar", amount: 7900, period: "Agosto", accountId: "main", currency: "MXN" },
  { category: "Alimentos", amount: 4200, period: "Septiembre", accountId: "main", currency: "MXN" },
  { category: "Alimentos", amount: 4650, period: "Agosto", accountId: "main", currency: "MXN" },
  { category: "Transporte", amount: 2100, period: "Septiembre", accountId: "main", currency: "MXN" },
  { category: "Transporte", amount: 2740, period: "Agosto", accountId: "main", currency: "MXN" },
  { category: "Servicios", amount: 1777.4, period: "Septiembre", accountId: "main", currency: "MXN" },
  { category: "Servicios", amount: 1680, period: "Agosto", accountId: "main", currency: "MXN" },
];

export const periodComparisonScenario: PersonalBankingScenario = {
  id: "period-comparison",
  label: "Comparación sin tabla",
  prompt: "Compáralo con el mes anterior y quita la tabla.",
  data: {
    currentSpent: 17531.4,
    previousSpent: 18120,
    spendingChange: -0.0325,
    comparisonCategories,
  },
  seriesScopes: [{ binding: "comparisonCategories", accountId: "main", currency: "MXN" }],
  specification: {
    version: "1",
    root: {
      type: "section",
      id: "comparison-root",
      ariaLabel: "Comparación mensual de gasto",
      surface: "primary",
      padding: "md",
      children: [
        { type: "heading", id: "comparison-title", content: "Gastaste 3.3% menos que el mes anterior", level: 2, size: "title" },
        { type: "text", id: "comparison-period", content: "Periodo consultado: 1–12 de septiembre contra 1–12 de agosto de 2026.", variant: "caption", tone: "secondary" },
        { type: "text", id: "comparison-evidence", content: "Evidencia: mismos días, cuenta principal y moneda MXN; sólo cargos contabilizados y categorizados.", variant: "caption", tone: "secondary" },
        { type: "select", id: "comparison-account", label: "Cuenta", event: "account.selection.changed", options: accountOptions, initialValue: "main" },
        {
          type: "grid",
          id: "comparison-metrics",
          columns: 3,
          gap: "md",
          children: [
            { type: "metric", id: "comparison-current", label: "Septiembre", valueBinding: "currentSpent", format: "currency", importance: "primary" },
            { type: "metric", id: "comparison-previous", label: "Agosto", valueBinding: "previousSpent", format: "currency", importance: "secondary" },
            { type: "metric", id: "comparison-change", label: "Variación", valueBinding: "spendingChange", format: "percent", importance: "secondary", semanticState: "financial.positive" },
          ],
        },
        {
          type: "visualization",
          id: "comparison-chart",
          ariaLabel: "Gasto por categoría comparado con el mes anterior",
          description: "Comparación homogénea de cargos en MXN para la cuenta principal.",
          mark: "grouped-bar",
          dataBinding: "comparisonCategories",
          encoding: {
            x: { field: "category", type: "nominal", label: "Categoría" },
            y: { field: "amount", type: "quantitative", label: "Monto" },
            group: { field: "period", type: "nominal", label: "Periodo" },
          },
          legend: { show: true, position: "bottom" },
          height: "md",
        },
        { type: "alert", id: "comparison-observation", title: "Lectura del cambio", message: "El total bajó, principalmente por Transporte y Alimentos. Hogar aumentó y conviene revisarlo por separado.", semanticState: "status.info" },
      ],
    },
  },
};

export const personalBankingScenarios: readonly PersonalBankingScenario[] = [
  availableBalanceScenario,
  recentTransactionsScenario,
  monthlySpendingScenario,
  periodComparisonScenario,
];
