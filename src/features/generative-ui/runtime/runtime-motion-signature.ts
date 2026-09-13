import type { UINode } from "../schemas/layout-node.js";

// Child-only changes should highlight the affected child, not every ancestor.
export function createNodeMotionSignature(node: UINode) {
  return JSON.stringify(node, (key, value: unknown) => (
    key === "children" || key === "template" || key === "empty" || key === "then" || key === "else"
      ? undefined
      : value
  ));
}
