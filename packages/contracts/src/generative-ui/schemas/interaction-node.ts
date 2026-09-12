import { z } from "zod";
import { nodeIdSchema } from "./node-id.js";

export const interactionIdSchema = nodeIdSchema;

export const interactionEventNameSchema = z.string()
  .min(3)
  .max(96)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

const labelSchema = z.string().trim().min(1).max(120);
const helpTextSchema = z.string().trim().min(1).max(240);
const optionSchema = z.object({
  value: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  label: labelSchema,
  disabled: z.boolean().optional(),
}).strict();
const textValidationSchema = z.object({
  required: z.boolean().optional(),
  minLength: z.number().int().min(0).max(500).optional(),
  maxLength: z.number().int().min(1).max(500).optional(),
  kind: z.enum(["text", "email", "search"]).optional(),
}).strict();

const commonFields = {
  id: interactionIdSchema,
  label: labelSchema,
  event: interactionEventNameSchema,
  helpText: helpTextSchema.optional(),
  disabled: z.boolean().optional(),
};

export const buttonNodeSchema = z.object({
  type: z.literal("button"),
  ...commonFields,
  variant: z.enum(["primary", "secondary", "ghost", "danger"]).optional(),
  state: z.enum(["idle", "loading", "disabled"]).optional(),
}).strict();

export const inputNodeSchema = z.object({
  type: z.literal("input"),
  ...commonFields,
  initialValue: z.string().max(500).optional(),
  placeholder: z.string().max(120).optional(),
  validation: textValidationSchema.optional(),
}).strict();

export const numberInputNodeSchema = z.object({
  type: z.literal("numberInput"),
  ...commonFields,
  initialValue: z.number().finite().optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().positive().finite().max(1_000_000).optional(),
  required: z.boolean().optional(),
}).strict();

export const selectNodeSchema = z.object({
  type: z.literal("select"),
  ...commonFields,
  options: z.array(optionSchema).min(1).max(100),
  initialValue: z.string().max(80).optional(),
  placeholder: z.string().trim().min(1).max(100).optional(),
  required: z.boolean().optional(),
}).strict();

export const multiSelectNodeSchema = z.object({
  type: z.literal("multiSelect"),
  ...commonFields,
  options: z.array(optionSchema).min(1).max(100),
  initialValue: z.array(z.string().max(80)).max(100).optional(),
  minSelections: z.number().int().min(0).max(100).optional(),
  maxSelections: z.number().int().min(1).max(100).optional(),
}).strict();

export const sliderNodeSchema = z.object({
  type: z.literal("slider"),
  ...commonFields,
  initialValue: z.number().finite().optional(),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive().finite().max(1_000_000).optional(),
  showValue: z.boolean().optional(),
}).strict();

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "La fecha no es válida");

export const datePickerNodeSchema = z.object({
  type: z.literal("datePicker"),
  ...commonFields,
  initialValue: isoDateSchema.optional(),
  min: isoDateSchema.optional(),
  max: isoDateSchema.optional(),
  required: z.boolean().optional(),
}).strict();

export const dateRangeNodeSchema = z.object({
  type: z.literal("dateRange"),
  ...commonFields,
  initialValue: z.object({ start: isoDateSchema.optional(), end: isoDateSchema.optional() }).strict().optional(),
  min: isoDateSchema.optional(),
  max: isoDateSchema.optional(),
  required: z.boolean().optional(),
}).strict();

export const checkboxNodeSchema = z.object({
  type: z.literal("checkbox"),
  ...commonFields,
  initialChecked: z.boolean().optional(),
  required: z.boolean().optional(),
}).strict();

export const switchNodeSchema = z.object({
  type: z.literal("switch"),
  ...commonFields,
  initialChecked: z.boolean().optional(),
}).strict();

export const radioGroupNodeSchema = z.object({
  type: z.literal("radioGroup"),
  ...commonFields,
  options: z.array(optionSchema).min(1).max(20),
  initialValue: z.string().max(80).optional(),
  required: z.boolean().optional(),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
}).strict();

export const interactionNodeSchemas = [
  buttonNodeSchema,
  inputNodeSchema,
  numberInputNodeSchema,
  selectNodeSchema,
  multiSelectNodeSchema,
  sliderNodeSchema,
  datePickerNodeSchema,
  dateRangeNodeSchema,
  checkboxNodeSchema,
  switchNodeSchema,
  radioGroupNodeSchema,
] as const;

export const interactionNodeBaseSchema = z.discriminatedUnion("type", interactionNodeSchemas);
export type InteractionNode = z.infer<typeof interactionNodeBaseSchema>;

function validateOptions(
  node: Extract<InteractionNode, { options: unknown }>,
  context: z.RefinementCtx,
) {
  const values = node.options.map((option) => option.value);
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Los valores de las opciones deben ser únicos" });
  }
  if ("initialValue" in node) {
    const initialValues = Array.isArray(node.initialValue) ? node.initialValue : [node.initialValue];
    if (initialValues.some((value) => value !== undefined && !values.includes(value))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["initialValue"], message: "El valor inicial no existe en las opciones" });
    }
  }
}

export function validateInteractionNode(node: InteractionNode, context: z.RefinementCtx) {
  if (node.type === "input" && node.validation?.minLength !== undefined && node.validation.maxLength !== undefined && node.validation.minLength > node.validation.maxLength) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["validation"], message: "minLength no puede superar maxLength" });
  }

  if ((node.type === "numberInput" || node.type === "slider") && node.min !== undefined && node.max !== undefined && node.min >= node.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["min"], message: "min debe ser menor que max" });
  }

  if ((node.type === "numberInput" || node.type === "slider") && node.initialValue !== undefined) {
    if ((node.min !== undefined && node.initialValue < node.min) || (node.max !== undefined && node.initialValue > node.max)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["initialValue"], message: "El valor inicial está fuera del rango" });
    }
  }

  if (node.type === "select" || node.type === "multiSelect" || node.type === "radioGroup") {
    validateOptions(node, context);
  }

  if (node.type === "multiSelect") {
    const minSelections = node.minSelections ?? 0;
    const maxSelections = node.maxSelections ?? node.options.length;
    if (minSelections > maxSelections || maxSelections > node.options.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxSelections"], message: "El rango de selección no es válido" });
    }
    if ((node.initialValue?.length ?? 0) > maxSelections) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["initialValue"], message: "La selección inicial supera el máximo" });
    }
  }

  if (node.type === "datePicker" || node.type === "dateRange") {
    if (node.min && node.max && node.min > node.max) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["min"], message: "La fecha mínima supera la máxima" });
    }
  }

  if (node.type === "dateRange" && node.initialValue?.start && node.initialValue.end && node.initialValue.start > node.initialValue.end) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["initialValue"], message: "El inicio supera el fin" });
  }
}

export const interactionNodeSchema = interactionNodeBaseSchema.superRefine(validateInteractionNode);
