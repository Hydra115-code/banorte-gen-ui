import type { UINode } from "../schemas/layout-node.ts";

export type UINodePath = readonly (string | number)[];
export type UINodePathIndex = ReadonlyMap<string, UINodePath>;

export function buildUINodePathIndex(root: UINode): UINodePathIndex {
  const index = new Map<string, UINodePath>();

  function visit(node: UINode, path: UINodePath) {
    if (node.id) index.set(node.id, path);

    if ("children" in node) {
      node.children.forEach((child, childIndex) => visit(child, [...path, "children", childIndex]));
    } else if (node.type === "tabs" || node.type === "accordion") {
      node.items.forEach((item, itemIndex) => item.children.forEach((child, childIndex) => (
        visit(child, [...path, "items", itemIndex, "children", childIndex])
      )));
    } else if (node.type === "repeat") {
      visit(node.template, [...path, "template"]);
      if (node.empty) visit(node.empty, [...path, "empty"]);
    } else if (node.type === "conditional") {
      visit(node.then, [...path, "then"]);
      if (node.else) visit(node.else, [...path, "else"]);
    }
  }

  visit(root, []);
  return index;
}

export function nodeAtIndexedPath(root: UINode, path: UINodePath): UINode | undefined {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = Reflect.get(current, segment);
  }
  return current && typeof current === "object" && "type" in current ? current as UINode : undefined;
}

function replaceValueAtPath(value: unknown, path: UINodePath, offset: number, replace: (current: unknown) => unknown): unknown {
  if (offset === path.length) return replace(value);
  const segment = path[offset]!;
  if (Array.isArray(value) && typeof segment === "number") {
    const next = value.slice();
    next[segment] = replaceValueAtPath(value[segment], path, offset + 1, replace);
    return next;
  }
  if (value !== null && typeof value === "object" && typeof segment === "string") {
    return { ...value, [segment]: replaceValueAtPath(Reflect.get(value, segment), path, offset + 1, replace) };
  }
  throw new Error("invalid_indexed_path");
}

export function transformNodeAtIndexedPath(root: UINode, path: UINodePath, transform: (node: UINode) => UINode): UINode {
  return replaceValueAtPath(root, path, 0, (value) => transform(value as UINode)) as UINode;
}

export function removeNodeAtIndexedPath(root: UINode, path: UINodePath): UINode {
  const index = path.at(-1);
  if (typeof index !== "number") throw new Error("root_cannot_be_removed");
  return replaceValueAtPath(root, path.slice(0, -1), 0, (value) => {
    if (!Array.isArray(value)) throw new Error("invalid_indexed_collection");
    const next = value.slice();
    next.splice(index, 1);
    return next;
  }) as UINode;
}
