export type NodeBindingCapability = "none" | "optional" | "required";
export type NodeEventCapability = "none" | "local" | "configured";

export interface NodeCapability {
  type: string;
  component: string;
  binding: NodeBindingCapability;
  event: NodeEventCapability;
}

export const nodeCapabilityMatrix = [
  { type: "container", component: "Container", binding: "none", event: "none" },
  { type: "section", component: "Section", binding: "none", event: "local" },
  { type: "stack", component: "Stack", binding: "none", event: "none" },
  { type: "grid", component: "Grid", binding: "none", event: "none" },
  { type: "flex", component: "Flex", binding: "none", event: "none" },
  { type: "split", component: "Split", binding: "none", event: "none" },
  { type: "scrollable", component: "Scrollable", binding: "none", event: "none" },
  { type: "divider", component: "Divider", binding: "none", event: "none" },
  { type: "tabs", component: "Tabs", binding: "none", event: "local" },
  { type: "accordion", component: "Accordion", binding: "none", event: "local" },
  { type: "text", component: "Text", binding: "none", event: "none" },
  { type: "heading", component: "Heading", binding: "none", event: "none" },
  { type: "metric", component: "Metric", binding: "required", event: "none" },
  { type: "badge", component: "Badge", binding: "none", event: "none" },
  { type: "alert", component: "Alert", binding: "none", event: "none" },
  { type: "progress", component: "Progress", binding: "required", event: "none" },
  { type: "icon", component: "Icon", binding: "none", event: "none" },
  { type: "list", component: "List", binding: "none", event: "none" },
  { type: "visualization", component: "Visualization", binding: "required", event: "local" },
  { type: "table", component: "Table", binding: "required", event: "configured" },
  { type: "button", component: "Button", binding: "none", event: "configured" },
  { type: "input", component: "Input", binding: "none", event: "configured" },
  { type: "numberInput", component: "NumberInput", binding: "none", event: "configured" },
  { type: "select", component: "Select", binding: "none", event: "configured" },
  { type: "multiSelect", component: "MultiSelect", binding: "none", event: "configured" },
  { type: "slider", component: "Slider", binding: "none", event: "configured" },
  { type: "datePicker", component: "DatePicker", binding: "none", event: "configured" },
  { type: "dateRange", component: "DateRange", binding: "none", event: "configured" },
  { type: "checkbox", component: "Checkbox", binding: "none", event: "configured" },
  { type: "switch", component: "Switch", binding: "none", event: "configured" },
  { type: "radioGroup", component: "RadioGroup", binding: "none", event: "configured" },
  { type: "repeat", component: "Repeat runtime", binding: "required", event: "none" },
  { type: "conditional", component: "Conditional runtime", binding: "required", event: "none" },
] as const satisfies readonly NodeCapability[];

export const knownNodeTypes: ReadonlySet<string> = new Set(
  nodeCapabilityMatrix.map((capability) => capability.type),
);
