import { readDataField } from "../data-binding/resolver/read-data-field";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { VisualizationNode } from "../schemas/visualization-node";
import type { VisualizationDataRow } from "./VisualizationCompiler";
import { maskFinancialIdentifier } from "../data-binding/formatting/mask-financial-identifier";
import { formatDataValue, localizeDisplayValue } from "../data-binding/formatting/format-data-value";

interface VisualizationDataTableProps {
  rows: VisualizationDataRow[];
  spec: VisualizationNode;
}

interface AccessibleColumn {
  field: string;
  label: string;
}

const MAX_ACCESSIBLE_ROWS = 100;

function getAccessibleColumns(spec: VisualizationNode): AccessibleColumn[] {
  const columns = new Map<string, AccessibleColumn>();

  Object.values(spec.encoding).forEach((channel) => {
    if (!channel || columns.has(channel.field)) return;
    columns.set(channel.field, {
      field: channel.field,
      label: channel.label ?? channel.field,
    });
  });

  return [...columns.values()];
}

const monetaryField = /(?:^|_)(?:amount|balance|spending|expense|income|gasto|importe|monto)(?:$|_)/iu;

function formatAccessibleValue(value: DataValue | undefined, field: string, row: VisualizationDataRow) {
  if (value === null || value === undefined) return "Sin dato";
  const masked = maskFinancialIdentifier(field, value);
  if (masked) return masked;
  if (typeof value === "number") {
    if (monetaryField.test(field)) {
      const currency = typeof row.currency === "string" && /^[A-Z]{3}$/u.test(row.currency)
        ? row.currency
        : "MXN";
      return formatDataValue(value, "currency", { locale: "es-MX", currency }) ?? "Sin dato";
    }
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return localizeDisplayValue(value);
  return "Dato no textual";
}

export function VisualizationDataTable({ rows, spec }: VisualizationDataTableProps) {
  const columns = getAccessibleColumns(spec);
  const visibleRows = rows.slice(0, MAX_ACCESSIBLE_ROWS);

  return (
    <details className="ui-visualization__data">
      <summary>Consultar datos de la gráfica</summary>
      <div
        aria-label={`Datos de ${spec.ariaLabel}`}
        className="ui-visualization__data-viewport"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">Datos utilizados para {spec.ariaLabel}</caption>
          <thead>
            <tr>{columns.map((column) => <th key={column.field} scope="col">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.field}>{formatAccessibleValue(readDataField(row, column.field), column.field, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ACCESSIBLE_ROWS ? (
        <p>Se muestran los primeros {MAX_ACCESSIBLE_ROWS} de {rows.length} registros.</p>
      ) : null}
    </details>
  );
}
