import { z } from "zod";
import { bindingReferenceSchema } from "../data-binding/schemas/binding-schema.js";
import { optionalNodeIdField } from "./node-id.js";

const fieldSchema = z.string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/)
  .refine(
    (field) => !field.split(".").some((segment) => ["__proto__", "prototype", "constructor"].includes(segment)),
    "El campo contiene un segmento reservado",
  );

const channelTypeSchema = z.enum(["nominal", "ordinal", "quantitative", "temporal"]);
const aggregationSchema = z.enum(["none", "sum", "average", "min", "max", "count"]);

export const positionChannelSchema = z.object({
  field: fieldSchema,
  type: channelTypeSchema,
  aggregate: aggregationSchema.optional(),
  label: z.string().trim().min(1).max(80).optional(),
}).strict();

export const groupChannelSchema = z.object({
  field: fieldSchema,
  type: z.enum(["nominal", "ordinal"]),
  label: z.string().trim().min(1).max(80).optional(),
}).strict();

export const visualizationMarkSchema = z.enum([
  "line",
  "area",
  "bar",
  "grouped-bar",
  "stacked-bar",
  "scatter",
  "donut",
  "heatmap",
]);

export const visualizationNodeBaseSchema = z.object({
  type: z.literal("visualization"),
  ...optionalNodeIdField,
  ariaLabel: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(300).optional(),
  mark: visualizationMarkSchema,
  dataBinding: bindingReferenceSchema,
  encoding: z.object({
    x: positionChannelSchema.optional(),
    y: positionChannelSchema.optional(),
    value: positionChannelSchema.optional(),
    group: groupChannelSchema.optional(),
  }).strict(),
  legend: z.object({
    show: z.boolean(),
    position: z.enum(["top", "right", "bottom"]).optional(),
  }).strict().optional(),
  sort: z.object({
    by: z.enum(["x", "y", "value", "group"]),
    direction: z.enum(["ascending", "descending"]),
  }).strict().optional(),
  height: z.enum(["sm", "md", "lg"]).optional(),
}).strict();

export function validateVisualizationNode(
  node: z.infer<typeof visualizationNodeBaseSchema>,
  context: z.RefinementCtx,
) {
  const { mark, encoding } = node;
  const requiresXY = ["line", "area", "bar", "grouped-bar", "stacked-bar", "scatter"].includes(mark);

  if (requiresXY && (!encoding.x || !encoding.y)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding"], message: `${mark} requiere x e y` });
  }

  if (requiresXY && encoding.y?.type !== "quantitative") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding", "y"], message: `${mark} requiere un eje y cuantitativo` });
  }

  for (const [channelName, channel] of Object.entries(encoding)) {
    if (channel && "aggregate" in channel && channel.aggregate && !["none", "count"].includes(channel.aggregate) && channel.type !== "quantitative") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding", channelName, "aggregate"], message: "La agregación requiere un campo cuantitativo" });
    }
  }

  if (["grouped-bar", "stacked-bar"].includes(mark) && !encoding.group) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding", "group"], message: `${mark} requiere agrupación` });
  }

  if (mark === "scatter" && (encoding.x?.type !== "quantitative" || encoding.y?.type !== "quantitative")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding"], message: "scatter requiere ejes cuantitativos" });
  }

  if (mark === "donut" && (!encoding.group || !encoding.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding"], message: "donut requiere group y value" });
  }

  if (mark === "donut" && (encoding.x || encoding.y)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding"], message: "donut no utiliza x ni y" });
  }

  if (mark === "heatmap" && (!encoding.x || !encoding.y || !encoding.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding"], message: "heatmap requiere x, y y value" });
  }

  if ((mark === "donut" || mark === "heatmap") && encoding.value?.type !== "quantitative") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["encoding", "value"], message: "value debe ser cuantitativo" });
  }

  if (mark === "donut" && node.sort && !["group", "value"].includes(node.sort.by)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sort", "by"], message: "donut solo puede ordenar por group o value" });
  }

  if (!["donut", "heatmap"].includes(mark) && node.sort?.by === "value") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sort", "by"], message: `${mark} no define el canal value` });
  }
}

export const visualizationNodeSchema = visualizationNodeBaseSchema.superRefine(validateVisualizationNode);

export type VisualizationNode = z.infer<typeof visualizationNodeSchema>;
export type VisualizationMark = z.infer<typeof visualizationMarkSchema>;
export type VisualizationChannel = z.infer<typeof positionChannelSchema>;
