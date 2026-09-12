import { z } from "zod";
import { MAX_LAYOUT_DEPTH, uiTreeSchema, type UINode } from "./layout-node.js";

export const UI_DSL_VERSION = "1" as const;
export const MAX_UI_NODES = 500;
export const MAX_UI_VISUALIZATIONS = 12;

export interface UISpecification {
  version: typeof UI_DSL_VERSION;
  root: UINode;
}

export interface UIValidationError {
  code: string;
  path: Array<string | number>;
  message: string;
}

export type UIValidationResult =
  | { success: true; data: UISpecification; errors: [] }
  | { success: false; data: null; errors: UIValidationError[] };

interface SpecificationStats {
  nodes: number;
  visualizations: number;
}

function collectSpecificationStats(root: UINode) {
  const stats: SpecificationStats = { nodes: 0, visualizations: 0 };
  const pending = [root];

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;

    stats.nodes += 1;
    if (node.type === "visualization") stats.visualizations += 1;

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

  return stats;
}

export const uiSpecificationSchema = z.object({
  version: z.literal(UI_DSL_VERSION),
  root: uiTreeSchema,
}).strict().superRefine((specification, context) => {
  const stats = collectSpecificationStats(specification.root);

  if (stats.nodes > MAX_UI_NODES) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["root"],
      message: `La especificación supera el máximo de ${MAX_UI_NODES} nodos`,
    });
  }

  if (stats.visualizations > MAX_UI_VISUALIZATIONS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["root"],
      message: `La especificación supera el máximo de ${MAX_UI_VISUALIZATIONS} visualizaciones`,
    });
  }
});

function issueToValidationError(issue: z.ZodIssue): UIValidationError {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

function readOwnDataProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function inspectRawTreeLimits(input: unknown): UIValidationError[] {
  if (input === null || typeof input !== "object") return [];

  const root = readOwnDataProperty(input, "root");
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 1 }];
  const visited = new WeakSet<object>();
  let nodes = 0;
  let visualizations = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || current.value === null || typeof current.value !== "object") continue;

    if (visited.has(current.value)) {
      return [{ code: "cyclic_structure", path: ["root"], message: "La especificación contiene una referencia circular" }];
    }
    visited.add(current.value);

    nodes += 1;
    if (nodes > MAX_UI_NODES) {
      return [{ code: "too_many_nodes", path: ["root"], message: `La especificación supera el máximo de ${MAX_UI_NODES} nodos` }];
    }
    if (current.depth > MAX_LAYOUT_DEPTH) {
      return [{ code: "too_deep", path: ["root"], message: `La profundidad máxima es ${MAX_LAYOUT_DEPTH}` }];
    }

    const type = readOwnDataProperty(current.value, "type");
    if (type === "visualization") {
      visualizations += 1;
      if (visualizations > MAX_UI_VISUALIZATIONS) {
        return [{ code: "too_many_visualizations", path: ["root"], message: `La especificación supera el máximo de ${MAX_UI_VISUALIZATIONS} visualizaciones` }];
      }
    }

    const nextDepth = current.depth + 1;
    const children = readOwnDataProperty(current.value, "children");
    if (Array.isArray(children)) {
      children.forEach((child) => pending.push({ value: child, depth: nextDepth }));
    }

    const items = readOwnDataProperty(current.value, "items");
    if ((type === "tabs" || type === "accordion") && Array.isArray(items)) {
      items.forEach((item) => {
        if (item === null || typeof item !== "object") return;
        const itemChildren = readOwnDataProperty(item, "children");
        if (Array.isArray(itemChildren)) {
          itemChildren.forEach((child) => pending.push({ value: child, depth: nextDepth }));
        }
      });
    }

    if (type === "repeat") {
      pending.push({ value: readOwnDataProperty(current.value, "template"), depth: nextDepth });
      const empty = readOwnDataProperty(current.value, "empty");
      if (empty !== undefined) pending.push({ value: empty, depth: nextDepth });
    } else if (type === "conditional") {
      pending.push({ value: readOwnDataProperty(current.value, "then"), depth: nextDepth });
      const otherwise = readOwnDataProperty(current.value, "else");
      if (otherwise !== undefined) pending.push({ value: otherwise, depth: nextDepth });
    }
  }

  return [];
}

export function validateUISpecification(input: unknown): UIValidationResult {
  try {
    const limitErrors = inspectRawTreeLimits(input);
    if (limitErrors.length > 0) return { success: false, data: null, errors: limitErrors };

    const result = uiSpecificationSchema.safeParse(input);

    if (!result.success) {
      return {
        success: false,
        data: null,
        errors: result.error.issues.map(issueToValidationError),
      };
    }

    return { success: true, data: result.data as UISpecification, errors: [] };
  } catch {
    return {
      success: false,
      data: null,
      errors: [{
        code: "validation_exception",
        path: [],
        message: "No fue posible validar la especificación",
      }],
    };
  }
}
