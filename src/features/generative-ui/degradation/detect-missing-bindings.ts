import { BindingResolver } from "../data-binding/resolver/BindingResolver";
import { DataRegistry } from "../data-binding/registry/DataRegistry";
import type { UINode } from "../schemas/layout-node";

function bindingIsMissing(resolver: BindingResolver, path: string, hasFallback = false) {
  if (path === "$item" || path === "$index" || path.startsWith("$item.")) return false;
  const status = resolver.resolve({ path }).status;
  return !hasFallback && status !== "resolved";
}

export function hasMissingBindings(root: UINode, registry?: DataRegistry) {
  const resolver = registry ? new BindingResolver(registry) : undefined;
  const pending = [root];

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;

    if ("children" in node) pending.push(...node.children);
    if (node.type === "tabs" || node.type === "accordion") {
      node.items.forEach((item) => pending.push(...item.children));
    } else if (node.type === "repeat") {
      pending.push(node.template);
      if (node.empty) pending.push(node.empty);
    } else if (node.type === "conditional") {
      pending.push(node.then);
      if (node.else) pending.push(node.else);
    }

    const bindings: Array<{ path: string; hasFallback?: boolean }> = [];
    if (node.type === "metric") {
      bindings.push({ path: node.valueBinding, hasFallback: node.fallback !== undefined });
      if (node.labelBinding) bindings.push({ path: node.labelBinding });
      if (node.trendBinding) bindings.push({ path: node.trendBinding });
      if (node.comparisonBinding) bindings.push({ path: node.comparisonBinding });
    } else if (node.type === "progress") {
      bindings.push({ path: node.valueBinding, hasFallback: node.fallback !== undefined });
    } else if (node.type === "visualization" || node.type === "table" || node.type === "repeat") {
      bindings.push({ path: node.dataBinding });
    } else if (node.type === "conditional") {
      bindings.push({ path: node.condition.binding });
    }

    if (bindings.some((binding) => !resolver || bindingIsMissing(resolver, binding.path, binding.hasFallback))) {
      return true;
    }
  }

  return false;
}
