import type { UISpecification, UINode } from "@banorte/contracts";

export interface UIAccessibilityIssue {
  code: "duplicate_id" | "missing_id" | "missing_label" | "invalid_default" | "missing_accessible_name";
  nodeId?: string;
}

const interactionTypes = new Set([
  "button", "input", "numberInput", "select", "multiSelect", "slider", "datePicker", "dateRange",
  "checkbox", "switch", "radioGroup",
]);

export function auditUISpecificationAccessibility(specification: UISpecification): UIAccessibilityIssue[] {
  const issues: UIAccessibilityIssue[] = [];
  const ids = new Set<string>();

  function visit(node: UINode) {
    if (!node.id) issues.push({ code: "missing_id" });
    else if (ids.has(node.id)) issues.push({ code: "duplicate_id", nodeId: node.id });
    else ids.add(node.id);

    if (interactionTypes.has(node.type) && (!("label" in node) || typeof node.label !== "string" || !node.label.trim())) {
      issues.push({ code: "missing_label", ...(node.id ? { nodeId: node.id } : {}) });
    }
    if ((node.type === "section" || node.type === "scrollable" || node.type === "tabs" || node.type === "table" || node.type === "visualization") && !node.ariaLabel.trim()) {
      issues.push({ code: "missing_accessible_name", ...(node.id ? { nodeId: node.id } : {}) });
    }
    if (node.type === "tabs" && node.defaultValue && !node.items.some((item) => item.value === node.defaultValue)) {
      issues.push({ code: "invalid_default", ...(node.id ? { nodeId: node.id } : {}) });
    }

    if ("children" in node) node.children.forEach(visit);
    else if (node.type === "tabs" || node.type === "accordion") node.items.forEach((item) => item.children.forEach(visit));
    else if (node.type === "repeat") {
      visit(node.template);
      if (node.empty) visit(node.empty);
    } else if (node.type === "conditional") {
      visit(node.then);
      if (node.else) visit(node.else);
    }
  }

  visit(specification.root);
  return issues;
}
