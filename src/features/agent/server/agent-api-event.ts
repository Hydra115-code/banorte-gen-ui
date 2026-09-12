import { z } from "zod";
import {
  agentDataAvailableSchema,
  agentDataRequestSchema,
  agentErrorSchema,
  agentPerformanceSchema,
  agentStatusSchema,
  agentUICompletedSchema,
} from "../contracts/agent-message";
import { uiPatchSchema } from "../../generative-ui/patches/ui-patch-schema";
import { dataPatchSchema } from "@banorte/contracts";

export const agentApiEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("data-requested"),
    ...agentDataRequestSchema.shape,
  }).strict(),
  z.object({
    type: z.literal("data-available"),
    ...agentDataAvailableSchema.shape,
  }).strict(),
  z.object({ type: z.literal("data-patch"), patch: dataPatchSchema }).strict(),
  z.object({ type: z.literal("status"), ...agentStatusSchema.shape }).strict(),
  z.object({
    type: z.literal("text-delta"),
    delta: z.string().min(1).max(8_000),
  }).strict(),
  z.object({
    type: z.literal("ui"),
    specification: z.unknown(),
    data: z.unknown().optional(),
  }).strict(),
  z.object({
    type: z.literal("ui-started"),
    specification: z.unknown(),
    data: z.unknown().optional(),
    revision: z.number().int().min(0).max(1_000_000),
  }).strict(),
  z.object({
    type: z.literal("ui-patch"),
    patch: uiPatchSchema,
  }).strict(),
  z.object({
    type: z.literal("ui-completed"),
    ...agentUICompletedSchema.shape,
  }).strict(),
  z.object({ type: z.literal("performance"), ...agentPerformanceSchema.shape }).strict(),
  z.object({ type: z.literal("error"), ...agentErrorSchema.shape }).strict(),
  z.object({ type: z.literal("done") }).strict(),
]);

export type AgentApiEvent = z.infer<typeof agentApiEventSchema>;
