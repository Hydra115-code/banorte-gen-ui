import { z } from "zod";
import { dataValueSchema } from "../data-binding/schemas/data-registry-schema.js";
import { nodeIdSchema } from "../schemas/node-id.js";
import { UI_DSL_VERSION } from "../schemas/ui-specification.js";

export const MAX_PATCH_REVISION = 1_000_000;
export const MAX_PATCH_CHANGES = 24;

const revisionSchema = z.number().int().min(0).max(MAX_PATCH_REVISION);
const patchBase = {
  version: z.literal(UI_DSL_VERSION),
  baseRevision: revisionSchema,
  revision: revisionSchema,
};
const forbiddenChangeKeys = new Set([
  "id",
  "type",
  "children",
  "items",
  "template",
  "empty",
  "then",
  "else",
  "__proto__",
  "prototype",
  "constructor",
]);

const changesSchema = z.record(z.string().min(1).max(64), dataValueSchema).superRefine((changes, context) => {
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Un patch update requiere al menos un cambio" });
  }
  if (keys.length > MAX_PATCH_CHANGES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Un patch admite hasta ${MAX_PATCH_CHANGES} cambios` });
  }
  if (keys.some((key) => forbiddenChangeKeys.has(key))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "El patch intenta modificar la estructura o identidad del nodo" });
  }
});

export const uiPatchSchema = z.discriminatedUnion("op", [
  z.object({
    ...patchBase,
    op: z.literal("add"),
    target: nodeIdSchema,
    node: z.unknown(),
    index: z.number().int().min(0).max(24).optional(),
  }).strict(),
  z.object({
    ...patchBase,
    op: z.literal("remove"),
    target: nodeIdSchema,
  }).strict(),
  z.object({
    ...patchBase,
    op: z.literal("replace"),
    target: nodeIdSchema,
    node: z.unknown(),
  }).strict(),
  z.object({
    ...patchBase,
    op: z.literal("update"),
    target: nodeIdSchema,
    changes: changesSchema,
  }).strict(),
  z.object({
    ...patchBase,
    op: z.literal("move"),
    target: nodeIdSchema,
    parent: nodeIdSchema,
    index: z.number().int().min(0).max(24).optional(),
  }).strict(),
]).superRefine((patch, context) => {
  if (patch.revision !== patch.baseRevision + 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["revision"], message: "La revisión debe avanzar exactamente una versión" });
  }
  if (patch.op === "move" && patch.target === patch.parent) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["parent"], message: "Un nodo no puede moverse dentro de sí mismo" });
  }
});

export type UIPatch = z.infer<typeof uiPatchSchema>;
