import type { UISpecification } from "../schemas/ui-specification.ts";
import type { UINode } from "../schemas/layout-node.ts";

const trustedSpecifications = new WeakSet<object>();
const trustedNodes = new WeakSet<object>();

function trustNode(node: UINode) {
  // Structural sharing keeps unchanged branches by reference. Once a branch has
  // been validated, there is no need to walk it again for every incremental patch.
  if (trustedNodes.has(node)) return;
  trustedNodes.add(node);
  if ("children" in node) node.children.forEach(trustNode);
  else if (node.type === "tabs" || node.type === "accordion") {
    node.items.forEach((item) => item.children.forEach(trustNode));
  } else if (node.type === "repeat") {
    trustNode(node.template);
    if (node.empty) trustNode(node.empty);
  } else if (node.type === "conditional") {
    trustNode(node.then);
    if (node.else) trustNode(node.else);
  }
}

export function trustValidatedUISpecification(specification: UISpecification) {
  trustedSpecifications.add(specification);
  trustNode(specification.root);
  return specification;
}

export function isTrustedUISpecification(value: unknown): value is UISpecification {
  return value !== null && typeof value === "object" && trustedSpecifications.has(value);
}

export function isTrustedUINode(value: unknown): value is UINode {
  return value !== null && typeof value === "object" && trustedNodes.has(value);
}
