import type { DataValue } from "../schemas/data-registry-schema";

export type DataDisplayFormat =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "percentage"
  | "date"
  | "datetime"
  | "status";

interface FormatDataValueOptions {
  locale: string;
  currency: string;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const contractualFinancialAmountPattern = /^-?\d{1,16}(?:\.\d{1,2})?$/;

function financialDisplayNumber(value: DataValue) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && contractualFinancialAmountPattern.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new TypeError("currency requiere un importe financiero válido");
}

export function formatDataValue(
  value: DataValue,
  format: DataDisplayFormat | undefined,
  options: FormatDataValueOptions,
): string | null {
  if (value === null) return null;

  if (format === "currency") {
    return new Intl.NumberFormat(options.locale, { style: "currency", currency: options.currency })
      .format(financialDisplayNumber(value));
  }

  if (format === "number") {
    if (typeof value !== "number") throw new TypeError("number requiere un número");
    return new Intl.NumberFormat(options.locale, { maximumFractionDigits: 2 }).format(value);
  }

  if (format === "percent" || format === "percentage") {
    if (typeof value !== "number") throw new TypeError("percentage requiere un número");
    return new Intl.NumberFormat(options.locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
  }

  if (format === "date" || format === "datetime") {
    if (typeof value !== "string" || !isoDatePattern.test(value)) throw new TypeError("date requiere una fecha ISO");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new TypeError("La fecha no es válida");
    return new Intl.DateTimeFormat(
      options.locale,
      format === "datetime"
        ? { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }
        : { dateStyle: "medium", timeZone: "UTC" },
    ).format(date);
  }

  if (typeof value === "string") return value;
  if (typeof value === "number") return new Intl.NumberFormat(options.locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return null;
}
