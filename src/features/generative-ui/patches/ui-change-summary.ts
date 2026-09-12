import type { UINode, UIPatch, UISpecification } from "@banorte/contracts";

export interface UIChangeSummary {
  items: readonly string[];
  revision: number;
  updatedAt: number;
}

function childNodes(node: UINode): UINode[] {
  if ("children" in node) return node.children;
  if (node.type === "tabs" || node.type === "accordion") return node.items.flatMap((item) => item.children);
  if (node.type === "repeat") return [node.template, ...(node.empty ? [node.empty] : [])];
  if (node.type === "conditional") return [node.then, ...(node.else ? [node.else] : [])];
  return [];
}

function indexNodes(specification: UISpecification) {
  const nodes = new Map<string, UINode>();
  const pending = [specification.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (node.id) nodes.set(node.id, node);
    pending.push(...childNodes(node));
  }
  return nodes;
}

function nodeLabel(node: UINode | undefined) {
  if (!node) return "una sección";
  if ("label" in node && typeof node.label === "string") return `“${node.label}”`;
  if (node.type === "heading" || node.type === "text") return `“${node.content.slice(0, 60)}”`;
  if ("ariaLabel" in node && typeof node.ariaLabel === "string") return `“${node.ariaLabel}”`;
  return "una sección";
}

export function describeUIPatch(patch: UIPatch, before: UISpecification): string {
  const nodes = indexNodes(before);
  const current = nodes.get(patch.target);
  if (patch.op === "add") return `Se agregó ${nodeLabel(patch.node as UINode)}.`;
  if (patch.op === "remove") return `Se eliminó ${nodeLabel(current)}.`;
  if (patch.op === "replace") return `Se reemplazó ${nodeLabel(current)}.`;
  if (patch.op === "move") return `Se reorganizó ${nodeLabel(current)}.`;
  return `Se actualizó ${nodeLabel(current)}.`;
}

export function summarizeSpecificationChange(
  before: UISpecification,
  after: UISpecification,
): string[] {
  const previous = indexNodes(before);
  const next = indexNodes(after);
  const added = [...next.keys()].filter((id) => !previous.has(id)).length;
  const removed = [...previous.keys()].filter((id) => !next.has(id)).length;
  let updated = 0;
  for (const [id, node] of next) {
    const previousNode = previous.get(id);
    if (previousNode && JSON.stringify(previousNode) !== JSON.stringify(node)) updated += 1;
  }

  return [
    ...(added ? [`Se agregaron ${added} elemento${added === 1 ? "" : "s"}.`] : []),
    ...(updated ? [`Se actualizaron ${updated} elemento${updated === 1 ? "" : "s"}.`] : []),
    ...(removed ? [`Se eliminaron ${removed} elemento${removed === 1 ? "" : "s"}.`] : []),
  ];
}

export function appendChange(items: readonly string[], change: string, limit = 5): string[] {
  return [...items.filter((item) => item !== change), change].slice(-limit);
}
