import type { UINode, UISpecification } from "@banorte/contracts";

export function collectFormValues(specification: UISpecification, sourceId: string, drafts: ReadonlyMap<string, string>): Record<string, string> | null {
  const find = (node: UINode): UINode[] | undefined => {
    const children = "children" in node ? node.children : [];
    if (children.some((child) => child.type === "button" && child.id === sourceId && child.event === "form.submit")) return children;
    for (const child of children) { const found = find(child); if (found) return found; }
    if (node.type === "tabs" || node.type === "accordion") {
      for (const item of node.items) for (const child of item.children) { const found = find(child); if (found) return found; }
    }
    return undefined;
  };
  const fields = find(specification.root)?.filter((node) => "event" in node && node.event === "form.value.changed");
  if (!fields?.length || fields.length > 12) return null;
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (!field.id || (field.type !== "input" && field.type !== "select" && field.type !== "datePicker")) return null;
    const value = drafts.get(field.id) ?? field.initialValue ?? "";
    if (typeof value !== "string" || value.length > 500) return null;
    if (field.type === "select" && (!value || !field.options.some((option) => option.value === value && !option.disabled))) return null;
    if (field.type === "input" && ((field.validation?.required && !value.trim()) || value.length > (field.validation?.maxLength ?? 500) || value.length < (field.validation?.minLength ?? 0))) return null;
    if (field.type === "datePicker" && ((field.required && !value) || (value && !/^\d{4}-\d{2}-\d{2}$/u.test(value)))) return null;
    values[field.id] = value;
  }
  return values;
}
