import type { UINode } from "../schemas/layout-node.ts";
import type { UISpecification, UIValidationResult } from "../schemas/ui-specification.ts";
import { validateUISpecification } from "../schemas/ui-specification.ts";

function mapNestedNodes(node: UINode, mapNode: (node: UINode, path: string) => UINode, path: string): UINode {
  if ("children" in node) {
    return {
      ...node,
      children: node.children.map((child, index) => mapNode(child, `${path}-${index + 1}`)),
    };
  }

  if (node.type === "tabs" || node.type === "accordion") {
    return {
      ...node,
      items: node.items.map((item, itemIndex) => ({
        ...item,
        children: item.children.map((child, childIndex) => mapNode(child, `${path}-${itemIndex + 1}-${childIndex + 1}`)),
      })),
    };
  }

  if (node.type === "repeat") {
    return {
      ...node,
      template: mapNode(node.template, `${path}-template`),
      ...(node.empty ? { empty: mapNode(node.empty, `${path}-empty`) } : {}),
    };
  }

  if (node.type === "conditional") {
    return {
      ...node,
      then: mapNode(node.then, `${path}-then`),
      ...(node.else ? { else: mapNode(node.else, `${path}-else`) } : {}),
    };
  }

  return node;
}

function identifyTree(root: UINode) {
  const usedIds = new Set<string>();
  let generatedIdSequence = 0;

  const identifyNode = (node: UINode, path: string): UINode => {
    let id = node.id;
    if (!id) {
      do {
        generatedIdSequence += 1;
        id = `${node.type}-${path}-${generatedIdSequence}`.slice(0, 64).replace(/-+$/u, "");
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    return mapNestedNodes({ ...node, id }, identifyNode, path);
  };

  return identifyNode(root, "root");
}

export function identifyUISpecification(input: unknown): UIValidationResult {
  const validation = validateUISpecification(input);
  if (!validation.success) return validation;

  return {
    success: true,
    data: {
      version: validation.data.version,
      root: identifyTree(validation.data.root),
    } satisfies UISpecification,
    errors: [],
  };
}

export function identifyUINode(input: unknown) {
  const identified = identifyUISpecification({ version: "1", root: input });
  return identified.success ? identified.data.root : null;
}

export function hasStableNodeIds(specification: UISpecification) {
  const pending = [specification.root];
  const ids = new Set<string>();

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node?.id || ids.has(node.id)) return false;
    ids.add(node.id);

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
  }

  return true;
}
