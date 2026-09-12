import type { UINode } from "../schemas/layout-node.ts";
import type { UISpecification, UIValidationError } from "../schemas/ui-specification.ts";
import { validateUISpecification } from "../schemas/ui-specification.ts";
import { hasStableNodeIds, identifyUINode, identifyUISpecification } from "./stable-node-ids.ts";
import { buildUINodePathIndex, nodeAtIndexedPath, removeNodeAtIndexedPath, transformNodeAtIndexedPath, type UINodePathIndex } from "./ui-node-path-index.ts";
import { trustValidatedUISpecification } from "./trusted-ui-specification.ts";
import { MAX_PATCH_REVISION, uiPatchSchema, type UIPatch } from "./ui-patch-schema.ts";

export const MAX_PATCH_HISTORY = 100;

export interface UIPatchState {
  revision: number;
  specification: UISpecification;
  nodeIndex: UINodePathIndex;
}

export interface UIPatchError {
  code: "invalid_patch" | "version_conflict" | "invalid_target" | "invalid_result";
  message: string;
  details?: UIValidationError[];
}

export type UIPatchResult =
  | { success: true; state: UIPatchState }
  | { success: false; state: UIPatchState; error: UIPatchError };

interface NodeTransformResult {
  found: boolean;
  node: UINode;
}

interface NodeRemovalResult {
  found: boolean;
  node: UINode;
  removed?: UINode;
}

function transformNode(node: UINode, target: string, transform: (node: UINode) => UINode): NodeTransformResult {
  if (node.id === target) return { found: true, node: transform(node) };

  if ("children" in node) {
    let found = false;
    const children = node.children.map((child) => {
      if (found) return child;
      const result = transformNode(child, target, transform);
      found = result.found;
      return result.node;
    });
    return { found, node: found ? { ...node, children } : node };
  }

  if (node.type === "tabs" || node.type === "accordion") {
    let found = false;
    const items = node.items.map((item) => ({
      ...item,
      children: item.children.map((child) => {
        if (found) return child;
        const result = transformNode(child, target, transform);
        found = result.found;
        return result.node;
      }),
    }));
    return { found, node: found ? { ...node, items } : node };
  }

  if (node.type === "repeat") {
    const template = transformNode(node.template, target, transform);
    if (template.found) return { found: true, node: { ...node, template: template.node } };
    if (node.empty) {
      const empty = transformNode(node.empty, target, transform);
      if (empty.found) return { found: true, node: { ...node, empty: empty.node } };
    }
  }

  if (node.type === "conditional") {
    const then = transformNode(node.then, target, transform);
    if (then.found) return { found: true, node: { ...node, then: then.node } };
    if (node.else) {
      const otherwise = transformNode(node.else, target, transform);
      if (otherwise.found) return { found: true, node: { ...node, else: otherwise.node } };
    }
  }

  return { found: false, node };
}

function removeFromCollections(node: UINode, target: string): NodeRemovalResult {
  if ("children" in node) {
    const directIndex = node.children.findIndex((child) => child.id === target);
    if (directIndex >= 0) {
      const children = node.children.slice();
      const [removed] = children.splice(directIndex, 1);
      return { found: true, node: { ...node, children }, removed };
    }

    for (let index = 0; index < node.children.length; index += 1) {
      const result = removeFromCollections(node.children[index]!, target);
      if (result.found) {
        const children = node.children.slice();
        children[index] = result.node;
        return { found: true, node: { ...node, children }, removed: result.removed };
      }
    }
  }

  if (node.type === "tabs" || node.type === "accordion") {
    for (let itemIndex = 0; itemIndex < node.items.length; itemIndex += 1) {
      const item = node.items[itemIndex]!;
      const directIndex = item.children.findIndex((child) => child.id === target);
      if (directIndex >= 0) {
        const children = item.children.slice();
        const [removed] = children.splice(directIndex, 1);
        const items = node.items.slice();
        items[itemIndex] = { ...item, children };
        return { found: true, node: { ...node, items }, removed };
      }
      for (let childIndex = 0; childIndex < item.children.length; childIndex += 1) {
        const result = removeFromCollections(item.children[childIndex]!, target);
        if (result.found) {
          const children = item.children.slice();
          children[childIndex] = result.node;
          const items = node.items.slice();
          items[itemIndex] = { ...item, children };
          return { found: true, node: { ...node, items }, removed: result.removed };
        }
      }
    }
  }

  if (node.type === "repeat") {
    const template = removeFromCollections(node.template, target);
    if (template.found) return { found: true, node: { ...node, template: template.node }, removed: template.removed };
    if (node.empty) {
      const empty = removeFromCollections(node.empty, target);
      if (empty.found) return { found: true, node: { ...node, empty: empty.node }, removed: empty.removed };
    }
  }

  if (node.type === "conditional") {
    const then = removeFromCollections(node.then, target);
    if (then.found) return { found: true, node: { ...node, then: then.node }, removed: then.removed };
    if (node.else) {
      const otherwise = removeFromCollections(node.else, target);
      if (otherwise.found) return { found: true, node: { ...node, else: otherwise.node }, removed: otherwise.removed };
    }
  }

  return { found: false, node };
}

function addToParent(root: UINode, target: string, child: UINode, index?: number): NodeTransformResult {
  return transformNode(root, target, (node) => {
    if (!("children" in node)) throw new Error("invalid_parent");
    const children = node.children.slice();
    children.splice(Math.min(index ?? children.length, children.length), 0, child);
    return { ...node, children };
  });
}

function parseNode(input: unknown) {
  return identifyUINode(input);
}

function applyIndexedOperation(root: UINode, patch: UIPatch, index: UINodePathIndex): NodeTransformResult {
  const targetPath = index.get(patch.target);
  if (!targetPath) return { found: false, node: root };
  if (patch.op === "update") {
    return { found: true, node: transformNodeAtIndexedPath(root, targetPath, (node) => ({ ...node, ...patch.changes }) as UINode) };
  }

  if (patch.op === "replace") {
    const replacement = parseNode(patch.node);
    if (!replacement) throw new Error("invalid_node");
    return { found: true, node: transformNodeAtIndexedPath(root, targetPath, () => replacement) };
  }

  if (patch.op === "add") {
    const child = parseNode(patch.node);
    if (!child) throw new Error("invalid_node");
    return { found: true, node: transformNodeAtIndexedPath(root, targetPath, (node) => {
      if (!("children" in node)) throw new Error("invalid_parent");
      const children = node.children.slice();
      children.splice(Math.min(patch.index ?? children.length, children.length), 0, child);
      return { ...node, children };
    }) };
  }

  if (patch.op === "remove") {
    return { found: true, node: removeNodeAtIndexedPath(root, targetPath) };
  }

  const moving = nodeAtIndexedPath(root, targetPath);
  if (!moving) return { found: false, node: root };
  const withoutMoving = removeNodeAtIndexedPath(root, targetPath);
  const parentPath = buildUINodePathIndex(withoutMoving).get(patch.parent);
  if (!parentPath) return { found: false, node: root };
  return { found: true, node: transformNodeAtIndexedPath(withoutMoving, parentPath, (node) => {
    if (!("children" in node)) throw new Error("invalid_parent");
    const children = node.children.slice();
    children.splice(Math.min(patch.index ?? children.length, children.length), 0, moving);
    return { ...node, children };
  }) };
}

export function createUIPatchState(specification: unknown, revision = 0): UIPatchResult {
  const isValidRevision = Number.isInteger(revision) && revision >= 0 && revision <= MAX_PATCH_REVISION;
  const identified = identifyUISpecification(specification);
  const emptySpecification = { version: "1", root: { type: "divider", id: "invalid-root" } } as UISpecification;
  const emptyState = { revision, specification: emptySpecification, nodeIndex: buildUINodePathIndex(emptySpecification.root) };
  if (!isValidRevision || !identified.success || !hasStableNodeIds(identified.data)) {
    return {
      success: false,
      state: emptyState,
      error: {
        code: "invalid_result",
        message: "La interfaz inicial no es válida",
        ...(!identified.success ? { details: identified.errors } : {}),
      },
    };
  }
  const trusted = trustValidatedUISpecification(identified.data);
  return { success: true, state: { revision, specification: trusted, nodeIndex: buildUINodePathIndex(trusted.root) } };
}

export function applyUIPatch(state: UIPatchState, input: unknown): UIPatchResult {
  const parsed = uiPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, state, error: { code: "invalid_patch", message: "El patch no cumple el contrato" } };
  }
  if (parsed.data.baseRevision !== state.revision) {
    return { success: false, state, error: { code: "version_conflict", message: "El patch parte de una revisión obsoleta" } };
  }

  const targetPath = state.nodeIndex.get(parsed.data.target);
  const targetNode = targetPath ? nodeAtIndexedPath(state.specification.root, targetPath) : undefined;
  if (!targetNode) {
    return { success: false, state, error: { code: "invalid_target", message: "El patch referencia un nodo inexistente" } };
  }
  if (parsed.data.op === "add" && !("children" in targetNode)) {
    return { success: false, state, error: { code: "invalid_target", message: "El destino del patch no admite la operación" } };
  }
  if (parsed.data.op === "move" && !state.nodeIndex.has(parsed.data.parent)) {
    return { success: false, state, error: { code: "invalid_target", message: "El destino del patch no admite la operación" } };
  }

  let transformed: NodeTransformResult;
  try {
    transformed = applyIndexedOperation(state.specification.root, parsed.data, state.nodeIndex);
  } catch {
    return { success: false, state, error: { code: "invalid_target", message: "El destino del patch no admite la operación" } };
  }
  if (!transformed.found) {
    return { success: false, state, error: { code: "invalid_target", message: "El patch referencia un nodo inexistente" } };
  }

  const candidate = { version: "1" as const, root: transformed.node };

  if (parsed.data.op === "update") {
    const updatedNode = nodeAtIndexedPath(candidate.root, targetPath!);
    // The shared contract forbids update patches from changing identity or any
    // structural field. Validating the changed node is therefore equivalent to
    // validating the whole specification for this operation: tree limits, IDs,
    // depth and visualization count cannot change. The node index also remains
    // valid because every path and ID is unchanged.
    if (!updatedNode || !identifyUINode(updatedNode)) {
      return {
        success: false,
        state,
        error: {
          code: "invalid_result",
          message: "El patch produciría una interfaz inválida",
        },
      };
    }

    const trusted = trustValidatedUISpecification(candidate);
    return {
      success: true,
      state: {
        revision: parsed.data.revision,
        specification: trusted,
        nodeIndex: state.nodeIndex,
      },
    };
  }

  const validation = validateUISpecification(candidate);
  if (!validation.success || !hasStableNodeIds(validation.data)) {
    return {
      success: false,
      state,
      error: {
        code: "invalid_result",
        message: "El patch produciría una interfaz inválida",
        ...(!validation.success ? { details: validation.errors } : {}),
      },
    };
  }

  // The candidate is composed exclusively from the previously validated tree and
  // the parsed patch. Returning it after full validation retains untouched object
  // references; returning Zod's parsed clone would invalidate structural sharing.
  const trusted = trustValidatedUISpecification(candidate);
  return {
    success: true,
    state: {
      revision: parsed.data.revision,
      specification: trusted,
      nodeIndex: buildUINodePathIndex(trusted.root),
    },
  };
}

export class UIPatchHistory {
  private readonly states: UIPatchState[];

  constructor(initialState: UIPatchState) {
    this.states = [initialState];
  }

  get current() {
    return this.states.at(-1)!;
  }

  apply(input: unknown) {
    const result = applyUIPatch(this.current, input);
    if (result.success) {
      this.states.push(result.state);
      if (this.states.length > MAX_PATCH_HISTORY) this.states.shift();
    }
    return result;
  }

  rollback() {
    if (this.states.length > 1) this.states.pop();
    return this.current;
  }
}
