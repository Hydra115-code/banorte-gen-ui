import { z } from "zod";
import { bindingReferenceSchema } from "../data-binding/schemas/binding-schema.js";
import { optionalNodeIdField } from "./node-id.js";
import { interactionEventNameSchema } from "./interaction-node.js";

export const MAX_TABLE_COLUMNS = 20;

export const tableFormatSchema = z.enum([
  "text",
  "number",
  "currency",
  "percentage",
  "date",
  "datetime",
  "status",
]);

export const tableColumnSchema = z.object({
  field: bindingReferenceSchema,
  label: z.string().trim().min(1).max(80),
  format: tableFormatSchema.optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  sortable: z.boolean().optional(),
}).strict();

export const tableNodeBaseSchema = z.object({
  type: z.literal("table"),
  ...optionalNodeIdField,
  ariaLabel: z.string().trim().min(1).max(160),
  caption: z.string().trim().min(1).max(200).optional(),
  dataBinding: bindingReferenceSchema,
  columns: z.array(tableColumnSchema).min(1).max(MAX_TABLE_COLUMNS),
  sorting: z.object({
    enabled: z.boolean(),
    default: z.object({
      field: bindingReferenceSchema,
      direction: z.enum(["ascending", "descending"]),
    }).strict().optional(),
  }).strict().optional(),
  filtering: z.object({
    enabled: z.boolean(),
    fields: z.array(bindingReferenceSchema).min(1).max(10).optional(),
    placeholder: z.string().trim().min(1).max(100).optional(),
  }).strict().optional(),
  pagination: z.object({
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
  }).strict().optional(),
  selection: z.object({
    mode: z.enum(["single", "multiple"]),
    rowIdField: bindingReferenceSchema,
    event: interactionEventNameSchema.optional(),
  }).strict().optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
  stickyHeader: z.boolean().optional(),
}).strict();

export function validateTableNode(
  node: z.infer<typeof tableNodeBaseSchema>,
  context: z.RefinementCtx,
) {
  const fields = node.columns.map((column) => column.field);

  if (new Set(fields).size !== fields.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["columns"], message: "Los campos de columna deben ser únicos" });
  }

  if (node.sorting?.default && !fields.includes(node.sorting.default.field)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sorting", "default", "field"], message: "La columna de orden inicial no existe" });
  }

  if (node.sorting?.default) {
    const column = node.columns.find((candidate) => candidate.field === node.sorting?.default?.field);
    if (column?.sortable === false) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sorting", "default", "field"], message: "La columna inicial no permite ordenamiento" });
    }
  }

  if (node.filtering?.fields?.some((field) => !fields.includes(field))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["filtering", "fields"], message: "El filtro referencia una columna inexistente" });
  }
}

export const tableNodeSchema = tableNodeBaseSchema.superRefine(validateTableNode);

export type TableNode = z.infer<typeof tableNodeSchema>;
export type TableColumn = z.infer<typeof tableColumnSchema>;
export type TableFormat = z.infer<typeof tableFormatSchema>;
