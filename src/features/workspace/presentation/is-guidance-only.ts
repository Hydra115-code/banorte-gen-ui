import type { UISpecification } from "../../generative-ui/schemas/ui-specification.js";

/** A text-only answer belongs in the conversation, not an empty full-height canvas. */
export function isGuidanceOnly(specification: UISpecification | null | undefined, hasData: boolean): boolean {
  if (!specification || hasData) return false;
  const pending = [specification.root];
  let hasMessage = false;

  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.type === "alert" || node.type === "text" || node.type === "heading") {
      hasMessage = true;
      continue;
    }
    if ("children" in node) {
      pending.push(...node.children);
      continue;
    }
    return false;
  }

  return hasMessage;
}
