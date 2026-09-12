import { z } from "zod";
import { dataValueSchema } from "./data-registry-schema.js";
import { UI_DSL_VERSION } from "../../schemas/ui-specification.js";

export const MAX_DATA_REVISION = 1_000_000;
const revisionSchema = z.number().int().min(0).max(MAX_DATA_REVISION);
const keySchema = z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
const base = {
  version: z.literal(UI_DSL_VERSION),
  baseRevision: revisionSchema,
  revision: revisionSchema,
  key: keySchema,
};

export const dataPatchSchema = z.discriminatedUnion("op", [
  z.object({ ...base, op: z.literal("add"), value: dataValueSchema }).strict(),
  z.object({ ...base, op: z.literal("update"), value: dataValueSchema }).strict(),
  z.object({ ...base, op: z.literal("remove") }).strict(),
  z.object({ ...base, op: z.literal("invalidate") }).strict(),
]).superRefine((patch, context) => {
  if (patch.revision !== patch.baseRevision + 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revision"],
      message: "La revisión de datos debe avanzar exactamente una versión",
    });
  }
});

export type DataPatch = z.infer<typeof dataPatchSchema>;
