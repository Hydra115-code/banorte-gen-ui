import { z } from "zod";
import {
  bindingFallbackSchema,
  bindingFormatSchema,
  bindingReferenceSchema,
  bindingValueTypeSchema,
  type BindingFallback,
  type BindingFormat,
  type BindingValueType,
} from "../data-binding/schemas/binding-schema.js";
import { optionalNodeIdField, type IdentifiableNode } from "./node-id.js";

export { bindingReferenceSchema } from "../data-binding/schemas/binding-schema.js";

const shortTextSchema = z.string().trim().min(1).max(120);
const bodyTextSchema = z.string().trim().min(1).max(600);

export const financialSemanticStateSchema = z.enum([
  "financial.positive",
  "financial.negative",
  "financial.neutral",
  "financial.warning",
]);

export const statusSemanticStateSchema = z.enum([
  "status.success",
  "status.warning",
  "status.error",
  "status.info",
]);

export interface TextNode extends IdentifiableNode {
  type: "text";
  content: string;
  variant?: "body" | "label" | "caption";
  tone?: "primary" | "secondary" | "muted";
  align?: "start" | "center" | "end";
}

export interface HeadingNode extends IdentifiableNode {
  type: "heading";
  content: string;
  level?: 2 | 3 | 4;
  size?: "display" | "title" | "section";
  align?: "start" | "center" | "end";
}

export interface MetricNode extends IdentifiableNode {
  type: "metric";
  label?: string;
  labelBinding?: string;
  valueBinding: string;
  format?: BindingFormat;
  valueType?: BindingValueType;
  fallback?: BindingFallback;
  trendBinding?: string;
  comparisonBinding?: string;
  importance?: "primary" | "secondary" | "tertiary";
  semanticState?: z.infer<typeof financialSemanticStateSchema>;
}

export interface BadgeNode extends IdentifiableNode {
  type: "badge";
  label: string;
  semanticState?: z.infer<typeof statusSemanticStateSchema> | "financial.neutral";
  emphasis?: "soft" | "strong";
}

export interface AlertNode extends IdentifiableNode {
  type: "alert";
  title?: string;
  message: string;
  semanticState?: z.infer<typeof statusSemanticStateSchema>;
}

export interface ProgressNode extends IdentifiableNode {
  type: "progress";
  label: string;
  valueBinding: string;
  fallback?: number;
  semanticState?: "status.success" | "status.warning" | "status.error" | "status.info";
  showValue?: boolean;
}

export interface IconNode extends IdentifiableNode {
  type: "icon";
  name: "info" | "success" | "warning" | "error" | "trend-up" | "trend-down" | "neutral";
  label?: string;
  size?: "sm" | "md" | "lg";
  semanticState?: z.infer<typeof statusSemanticStateSchema> | z.infer<typeof financialSemanticStateSchema>;
}

export interface ListItemNode {
  label: string;
  supportingText?: string;
}

export interface ListNode extends IdentifiableNode {
  type: "list";
  ordered?: boolean;
  items: ListItemNode[];
}

export type ContentNode =
  | TextNode
  | HeadingNode
  | MetricNode
  | BadgeNode
  | AlertNode
  | ProgressNode
  | IconNode
  | ListNode;

export const textNodeSchema = z.object({
  type: z.literal("text"),
  ...optionalNodeIdField,
  content: bodyTextSchema,
  variant: z.enum(["body", "label", "caption"]).optional(),
  tone: z.enum(["primary", "secondary", "muted"]).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
}).strict();

export const headingNodeSchema = z.object({
  type: z.literal("heading"),
  ...optionalNodeIdField,
  content: shortTextSchema,
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  size: z.enum(["display", "title", "section"]).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
}).strict();

export const metricNodeBaseSchema = z.object({
  type: z.literal("metric"),
  ...optionalNodeIdField,
  label: shortTextSchema.optional(),
  labelBinding: bindingReferenceSchema.optional(),
  valueBinding: bindingReferenceSchema,
  format: bindingFormatSchema.optional(),
  valueType: bindingValueTypeSchema.optional(),
  fallback: bindingFallbackSchema.optional(),
  trendBinding: bindingReferenceSchema.optional(),
  comparisonBinding: bindingReferenceSchema.optional(),
  importance: z.enum(["primary", "secondary", "tertiary"]).optional(),
  semanticState: financialSemanticStateSchema.optional(),
}).strict();

export function validateMetricNode(node: MetricNode, context: z.RefinementCtx) {
  if ((node.label === undefined) === (node.labelBinding === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Metric requiere exactamente uno entre label y labelBinding",
    });
  }
}

export const metricNodeSchema = metricNodeBaseSchema.superRefine(validateMetricNode);

export const badgeNodeSchema = z.object({
  type: z.literal("badge"),
  ...optionalNodeIdField,
  label: shortTextSchema,
  semanticState: z.union([statusSemanticStateSchema, z.literal("financial.neutral")]).optional(),
  emphasis: z.enum(["soft", "strong"]).optional(),
}).strict();

export const alertNodeSchema = z.object({
  type: z.literal("alert"),
  ...optionalNodeIdField,
  title: shortTextSchema.optional(),
  message: bodyTextSchema,
  semanticState: statusSemanticStateSchema.optional(),
}).strict();

export const progressNodeSchema = z.object({
  type: z.literal("progress"),
  ...optionalNodeIdField,
  label: shortTextSchema,
  valueBinding: bindingReferenceSchema,
  fallback: z.number().finite().min(0).max(100).optional(),
  semanticState: z.enum(["status.success", "status.warning", "status.error", "status.info"]).optional(),
  showValue: z.boolean().optional(),
}).strict();

export const iconNodeSchema = z.object({
  type: z.literal("icon"),
  ...optionalNodeIdField,
  name: z.enum(["info", "success", "warning", "error", "trend-up", "trend-down", "neutral"]),
  label: shortTextSchema.optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
  semanticState: z.union([statusSemanticStateSchema, financialSemanticStateSchema]).optional(),
}).strict();

const listItemSchema = z.object({
  label: shortTextSchema,
  supportingText: bodyTextSchema.optional(),
}).strict();

export const listNodeSchema = z.object({
  type: z.literal("list"),
  ...optionalNodeIdField,
  ordered: z.boolean().optional(),
  items: z.array(listItemSchema).min(1).max(20),
}).strict();

export const contentNodeSchemas = [
  textNodeSchema,
  headingNodeSchema,
  metricNodeBaseSchema,
  badgeNodeSchema,
  alertNodeSchema,
  progressNodeSchema,
  iconNodeSchema,
  listNodeSchema,
] as const;

export const contentNodeSchema = z.discriminatedUnion("type", contentNodeSchemas).superRefine((node, context) => {
  if (node.type === "metric") validateMetricNode(node, context);
});
