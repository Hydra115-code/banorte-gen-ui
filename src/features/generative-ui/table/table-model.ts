import { formatDataValue } from "../data-binding/formatting/format-data-value";
import { maskFinancialIdentifier } from "../data-binding/formatting/mask-financial-identifier";
import { readDataField } from "../data-binding/resolver/read-data-field";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { TableColumn, TableNode } from "../schemas/table-node";

export interface TableDataRow {
  [key: string]: DataValue;
}

export interface IndexedTableRow {
  data: TableDataRow;
  sourceIndex: number;
}

export interface TableSortState {
  field: string;
  direction: "ascending" | "descending";
}

export interface TableViewState {
  query: string;
  sort?: TableSortState;
  page: number;
}

interface TableModelOptions {
  locale: string;
  currency: string;
}

function isTableDataRow(value: DataValue): value is TableDataRow {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function searchableValue(value: DataValue | undefined) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).toLocaleLowerCase();
}

function compareValues(left: DataValue | undefined, right: DataValue | undefined, locale: string) {
  if (left === right) return 0;
  if (left === null || left === undefined || typeof left === "object") return 1;
  if (right === null || right === undefined || typeof right === "object") return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), locale, { numeric: true, sensitivity: "base" });
}

export function formatTableCell(
  row: TableDataRow,
  column: TableColumn,
  options: TableModelOptions,
) {
  const value = readDataField(row, column.field);
  if (value === undefined) return "—";

  try {
    return maskFinancialIdentifier(column.field, value)
      ?? formatDataValue(value, column.format, options)
      ?? "—";
  } catch {
    return "—";
  }
}

export function tableStatus(value: DataValue | undefined) {
  if (typeof value !== "string") return "neutral" as const;
  const normalized = value.toLocaleLowerCase();
  if (["success", "positive", "completed", "active"].includes(normalized)) return "success" as const;
  if (["warning", "pending"].includes(normalized)) return "warning" as const;
  if (["error", "negative", "failed", "inactive"].includes(normalized)) return "error" as const;
  if (normalized === "info") return "info" as const;
  return "neutral" as const;
}

export function buildTablePage(
  data: DataValue[],
  spec: TableNode,
  state: TableViewState,
  options: TableModelOptions,
) {
  const indexedRows: IndexedTableRow[] = data
    .map((value, sourceIndex) => ({ value, sourceIndex }))
    .filter((item): item is { value: TableDataRow; sourceIndex: number } => isTableDataRow(item.value))
    .map(({ value, sourceIndex }) => ({ data: value, sourceIndex }));
  const normalizedQuery = state.query.trim().toLocaleLowerCase();
  const filterFields = spec.filtering?.fields ?? spec.columns.map((column) => column.field);
  const filteredRows = normalizedQuery
    ? indexedRows.filter(({ data: row }) => filterFields.some((field) => searchableValue(readDataField(row, field)).includes(normalizedQuery)))
    : indexedRows;
  const sortedRows = state.sort
    ? [...filteredRows].sort((left, right) => {
        const comparison = compareValues(
          readDataField(left.data, state.sort?.field ?? ""),
          readDataField(right.data, state.sort?.field ?? ""),
          options.locale,
        );
        return state.sort?.direction === "descending" ? -comparison : comparison;
      })
    : filteredRows;
  const pageSize = spec.pagination?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const page = Math.min(Math.max(1, state.page), totalPages);
  const start = (page - 1) * pageSize;

  return {
    rows: sortedRows.slice(start, start + pageSize),
    totalRows: sortedRows.length,
    totalPages,
    page,
    pageSize,
  };
}
