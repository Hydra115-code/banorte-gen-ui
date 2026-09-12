import { z } from "zod";
import {
  alertNodeSchema,
  badgeNodeSchema,
  headingNodeSchema,
  iconNodeSchema,
  listNodeSchema,
  metricNodeBaseSchema,
  progressNodeSchema,
  textNodeSchema,
  validateMetricNode,
  type ContentNode,
} from "./content-node.js";
import {
  validateVisualizationNode,
  visualizationNodeBaseSchema,
  type VisualizationNode,
} from "./visualization-node.js";
import { tableNodeBaseSchema, validateTableNode, type TableNode } from "./table-node.js";
import {
  buttonNodeSchema,
  checkboxNodeSchema,
  datePickerNodeSchema,
  dateRangeNodeSchema,
  inputNodeSchema,
  multiSelectNodeSchema,
  numberInputNodeSchema,
  radioGroupNodeSchema,
  selectNodeSchema,
  sliderNodeSchema,
  switchNodeSchema,
  validateInteractionNode,
  type InteractionNode,
} from "./interaction-node.js";
import { isScopedBindingReference } from "../data-binding/schemas/binding-schema.js";
import {
  createConditionalNodeSchema,
  createRepeatNodeSchema,
  MAX_LOGIC_NESTING,
  type LogicCondition,
  type LogicNode,
} from "./logic-node.js";
import { optionalNodeIdField, type IdentifiableNode } from "./node-id.js";

export const MAX_LAYOUT_DEPTH = 12;
export const MAX_LAYOUT_CHILDREN = 24;

export const layoutGapSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl"]);
export const layoutPaddingSchema = z.enum(["none", "sm", "md", "lg"]);
export const layoutAlignmentSchema = z.enum(["start", "center", "end", "stretch"]);

type LayoutGap = z.infer<typeof layoutGapSchema>;
type LayoutPadding = z.infer<typeof layoutPaddingSchema>;
type LayoutAlignment = z.infer<typeof layoutAlignmentSchema>;

interface ChildrenNode extends IdentifiableNode {
  children: UINode[];
}

export interface ContainerNode extends ChildrenNode {
  type: "container";
  size?: "sm" | "md" | "lg" | "full";
  padding?: LayoutPadding;
}

export interface SectionNode extends ChildrenNode {
  type: "section";
  ariaLabel: string;
  surface?: "transparent" | "primary" | "secondary" | "elevated";
  padding?: LayoutPadding;
}

export interface StackNode extends ChildrenNode {
  type: "stack";
  gap?: LayoutGap;
  align?: LayoutAlignment;
}

export interface GridNode extends ChildrenNode {
  type: "grid";
  columns?: 1 | 2 | 3 | 4;
  gap?: LayoutGap;
  align?: LayoutAlignment;
}

export interface FlexNode extends ChildrenNode {
  type: "flex";
  direction?: "row" | "column";
  wrap?: "wrap" | "nowrap";
  justify?: "start" | "center" | "end" | "between";
  align?: LayoutAlignment;
  gap?: LayoutGap;
}

export interface SplitNode extends ChildrenNode {
  type: "split";
  ratio?: "equal" | "sidebar-start" | "sidebar-end";
  collapseAt?: "sm" | "md" | "never";
  gap?: LayoutGap;
}

export interface ScrollableNode extends ChildrenNode {
  type: "scrollable";
  ariaLabel: string;
  axis?: "horizontal" | "vertical" | "both";
  maxSize?: "sm" | "md" | "lg" | "viewport";
}

export interface DividerNode extends IdentifiableNode {
  type: "divider";
  orientation?: "horizontal" | "vertical";
  strength?: "subtle" | "strong";
}

export interface TabItemNode extends ChildrenNode {
  value: string;
  label: string;
}

export interface TabsNode extends IdentifiableNode {
  type: "tabs";
  ariaLabel: string;
  defaultValue?: string;
  items: TabItemNode[];
}

export interface AccordionItemNode extends ChildrenNode {
  value: string;
  label: string;
}

export interface AccordionNode extends IdentifiableNode {
  type: "accordion";
  mode?: "single" | "multiple";
  defaultOpen?: string[];
  items: AccordionItemNode[];
}

export type LayoutNode =
  | ContainerNode
  | SectionNode
  | StackNode
  | GridNode
  | FlexNode
  | SplitNode
  | ScrollableNode
  | DividerNode
  | TabsNode
  | AccordionNode;

export interface RepeatUINode {
  type: "repeat";
  id?: string;
  dataBinding: string;
  template: UINode;
  empty?: UINode;
}

export interface ConditionalUINode {
  type: "conditional";
  id?: string;
  condition: LogicCondition;
  then: UINode;
  else?: UINode;
}
export type LogicUINode = RepeatUINode | ConditionalUINode;
export type UINode = LayoutNode | ContentNode | VisualizationNode | TableNode | InteractionNode | LogicUINode;

const nodeValueSchema = z.string().min(1).max(48).regex(/^[a-zA-Z0-9_-]+$/);
const nodeLabelSchema = z.string().trim().min(1).max(120);
const childrenSchema = z.array(
  z.lazy(() => uiNodeSchema) as z.ZodType<UINode>,
).max(MAX_LAYOUT_CHILDREN);

export const containerNodeSchema = z.object({
  type: z.literal("container"),
  ...optionalNodeIdField,
  size: z.enum(["sm", "md", "lg", "full"]).optional(),
  padding: layoutPaddingSchema.optional(),
  children: childrenSchema,
}).strict();

export const sectionNodeSchema = z.object({
  type: z.literal("section"),
  ...optionalNodeIdField,
  ariaLabel: nodeLabelSchema,
  surface: z.enum(["transparent", "primary", "secondary", "elevated"]).optional(),
  padding: layoutPaddingSchema.optional(),
  children: childrenSchema,
}).strict();

export const stackNodeSchema = z.object({
  type: z.literal("stack"),
  ...optionalNodeIdField,
  gap: layoutGapSchema.optional(),
  align: layoutAlignmentSchema.optional(),
  children: childrenSchema,
}).strict();

export const gridNodeSchema = z.object({
  type: z.literal("grid"),
  ...optionalNodeIdField,
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  gap: layoutGapSchema.optional(),
  align: layoutAlignmentSchema.optional(),
  children: childrenSchema,
}).strict();

export const flexNodeSchema = z.object({
  type: z.literal("flex"),
  ...optionalNodeIdField,
  direction: z.enum(["row", "column"]).optional(),
  wrap: z.enum(["wrap", "nowrap"]).optional(),
  justify: z.enum(["start", "center", "end", "between"]).optional(),
  align: layoutAlignmentSchema.optional(),
  gap: layoutGapSchema.optional(),
  children: childrenSchema,
}).strict();

export const splitNodeSchema = z.object({
  type: z.literal("split"),
  ...optionalNodeIdField,
  ratio: z.enum(["equal", "sidebar-start", "sidebar-end"]).optional(),
  collapseAt: z.enum(["sm", "md", "never"]).optional(),
  gap: layoutGapSchema.optional(),
  children: childrenSchema.min(2).max(2),
}).strict();

export const scrollableNodeSchema = z.object({
  type: z.literal("scrollable"),
  ...optionalNodeIdField,
  ariaLabel: nodeLabelSchema,
  axis: z.enum(["horizontal", "vertical", "both"]).optional(),
  maxSize: z.enum(["sm", "md", "lg", "viewport"]).optional(),
  children: childrenSchema,
}).strict();

export const dividerNodeSchema = z.object({
  type: z.literal("divider"),
  ...optionalNodeIdField,
  orientation: z.enum(["horizontal", "vertical"]).optional(),
  strength: z.enum(["subtle", "strong"]).optional(),
}).strict();

const tabItemSchema = z.object({
  value: nodeValueSchema,
  label: nodeLabelSchema,
  children: childrenSchema,
}).strict();

export const tabsNodeSchema = z.object({
  type: z.literal("tabs"),
  ...optionalNodeIdField,
  ariaLabel: nodeLabelSchema,
  defaultValue: nodeValueSchema.optional(),
  items: z.array(tabItemSchema).min(1).max(8),
}).strict();

const accordionItemSchema = z.object({
  value: nodeValueSchema,
  label: nodeLabelSchema,
  children: childrenSchema,
}).strict();

export const accordionNodeSchema = z.object({
  type: z.literal("accordion"),
  ...optionalNodeIdField,
  mode: z.enum(["single", "multiple"]).optional(),
  defaultOpen: z.array(nodeValueSchema).max(10).optional(),
  items: z.array(accordionItemSchema).min(1).max(10),
}).strict();

const nestedUINodeSchema = z.lazy(() => uiNodeSchema) as z.ZodType<UINode>;
export const repeatNodeSchema = createRepeatNodeSchema(nestedUINodeSchema);
export const conditionalNodeSchema = createConditionalNodeSchema(nestedUINodeSchema);
const logicNodeBaseSchema = z.discriminatedUnion("type", [
  repeatNodeSchema,
  conditionalNodeSchema,
]) as unknown as z.ZodType<LogicNode<UINode>>;

export const layoutNodeSchema = z.lazy(() =>
  z.discriminatedUnion("type", [
    containerNodeSchema,
    sectionNodeSchema,
    stackNodeSchema,
    gridNodeSchema,
    flexNodeSchema,
    splitNodeSchema,
    scrollableNodeSchema,
    dividerNodeSchema,
    tabsNodeSchema,
    accordionNodeSchema,
  ]),
) as z.ZodType<LayoutNode>;

export const uiNodeSchema = z.lazy(() =>
  z.discriminatedUnion("type", [
    containerNodeSchema,
    sectionNodeSchema,
    stackNodeSchema,
    gridNodeSchema,
    flexNodeSchema,
    splitNodeSchema,
    scrollableNodeSchema,
    dividerNodeSchema,
    tabsNodeSchema,
    accordionNodeSchema,
    textNodeSchema,
    headingNodeSchema,
    metricNodeBaseSchema,
    badgeNodeSchema,
    alertNodeSchema,
    progressNodeSchema,
    iconNodeSchema,
    listNodeSchema,
    visualizationNodeBaseSchema,
    tableNodeBaseSchema,
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
    repeatNodeSchema,
    conditionalNodeSchema,
  ]),
) as z.ZodType<UINode>;

function isInteractionNode(node: UINode): node is InteractionNode {
  return "event" in node && "id" in node;
}

function visitChildren(
  node: UINode,
  depth: number,
  context: z.RefinementCtx,
  nodeIds = new Set<string>(),
  logicDepth = 0,
  scopedDepth = 0,
) {
  if (depth > MAX_LAYOUT_DEPTH) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La profundidad máxima es ${MAX_LAYOUT_DEPTH}`,
    });
    return;
  }

  if ("children" in node) {
    node.children.forEach((child) => visitChildren(
      child,
      depth + 1,
      context,
      nodeIds,
      logicDepth,
      scopedDepth,
    ));
  }

  validateScopedBindings(node, scopedDepth, context);

  if (node.id) {
    if (nodeIds.has(node.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["id"], message: `El id ${node.id} está duplicado` });
    }
    nodeIds.add(node.id);
  }

  if (node.type === "metric") validateMetricNode(node, context);

  if (node.type === "visualization") {
    validateVisualizationNode(node, context);
  }

  if (node.type === "table") {
    validateTableNode(node, context);
  }

  if (isInteractionNode(node)) {
    validateInteractionNode(node, context);
  }

  if (node.type === "repeat") {
    if (logicDepth >= MAX_LOGIC_NESTING) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El anidamiento lógico máximo es ${MAX_LOGIC_NESTING}`,
      });
      return;
    }

    visitChildren(node.template, depth + 1, context, nodeIds, logicDepth + 1, scopedDepth + 1);
    if (node.empty) {
      visitChildren(node.empty, depth + 1, context, nodeIds, logicDepth + 1, scopedDepth);
    }
  }

  if (node.type === "conditional") {
    if (logicDepth >= MAX_LOGIC_NESTING) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El anidamiento lógico máximo es ${MAX_LOGIC_NESTING}`,
      });
      return;
    }

    visitChildren(node.then, depth + 1, context, nodeIds, logicDepth + 1, scopedDepth);
    if (node.else) {
      visitChildren(node.else, depth + 1, context, nodeIds, logicDepth + 1, scopedDepth);
    }
  }

  if (node.type === "tabs" || node.type === "accordion") {
    const values = node.items.map((item) => item.value);

    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Los valores de los items deben ser únicos" });
    }

    if (node.type === "tabs" && node.defaultValue && !values.includes(node.defaultValue)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "El tab inicial no existe" });
    }

    if (node.type === "accordion") {
      const defaultOpen = node.defaultOpen ?? [];

      if (node.mode !== "multiple" && defaultOpen.length > 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "El modo single permite un elemento abierto" });
      }

      if (defaultOpen.some((value) => !values.includes(value))) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Un elemento inicial no existe" });
      }
    }

    node.items.forEach((item) => {
      item.children.forEach((child) => visitChildren(
        child,
        depth + 1,
        context,
        nodeIds,
        logicDepth,
        scopedDepth,
      ));
    });
  }
}

function validateScopedBindings(node: UINode, scopedDepth: number, context: z.RefinementCtx) {
  const bindings: string[] = [];

  if (node.type === "metric") {
    bindings.push(node.valueBinding);
    if (node.labelBinding) bindings.push(node.labelBinding);
    if (node.trendBinding) bindings.push(node.trendBinding);
    if (node.comparisonBinding) bindings.push(node.comparisonBinding);
  } else if (node.type === "progress") {
    bindings.push(node.valueBinding);
  } else if (node.type === "visualization" || node.type === "table" || node.type === "repeat") {
    bindings.push(node.dataBinding);
  } else if (node.type === "conditional") {
    bindings.push(node.condition.binding);
  }

  if (scopedDepth === 0 && bindings.some(isScopedBindingReference)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Las referencias $item y $index solo son válidas dentro de Repeat",
    });
  }
}

export const layoutTreeSchema = layoutNodeSchema.superRefine((node, context) => {
  visitChildren(node, 1, context);
});

export const uiTreeSchema = uiNodeSchema.superRefine((node, context) => {
  visitChildren(node, 1, context);
});

export const logicNodeSchema = logicNodeBaseSchema.superRefine((node, context) => {
  visitChildren(node as LogicUINode, 1, context);
});
