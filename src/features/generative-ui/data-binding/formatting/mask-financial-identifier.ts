import type { DataValue } from "../schemas/data-registry-schema.js";

const sensitiveFieldNames = new Set([
  "account",
  "accountid",
  "accountno",
  "accountnumber",
  "card",
  "cardid",
  "cardno",
  "cardnumber",
  "clabe",
  "cuenta",
  "cuentaid",
  "iban",
  "numerocuenta",
  "numerotarjeta",
  "pan",
  "tarjeta",
  "tarjetaid",
]);

function normalizedLeaf(path: string) {
  return (path.split(".").at(-1) ?? path)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]/gu, "")
    .toLocaleLowerCase("en-US");
}

export function isSensitiveFinancialField(path: string): boolean {
  return sensitiveFieldNames.has(normalizedLeaf(path));
}

/** Returns undefined when the field is not a protected financial identifier. */
export function maskFinancialIdentifier(path: string, value: DataValue): string | undefined {
  if (!isSensitiveFinancialField(path)) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return "••••";

  const normalized = String(value).replace(/[^a-zA-Z0-9]/gu, "");
  if (normalized.length <= 4) return "••••";
  return `•••• ${normalized.slice(-4)}`;
}
