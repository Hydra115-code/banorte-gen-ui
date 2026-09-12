import { z } from "zod";

export const nodeIdSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

export interface IdentifiableNode {
  id?: string;
}

export const optionalNodeIdField = {
  id: nodeIdSchema.optional(),
};
