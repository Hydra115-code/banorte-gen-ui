import { z } from "zod";
import { dataRegistrySchema, dataValueSchema } from "./generative-ui/data-binding/schemas/data-registry-schema.js";
import { dataPatchSchema } from "./generative-ui/data-binding/schemas/data-patch-schema.js";
import { uiPatchSchema } from "./generative-ui/patches/ui-patch-schema.js";
import { interactionEventNameSchema } from "./generative-ui/schemas/interaction-node.js";
import { nodeIdSchema } from "./generative-ui/schemas/node-id.js";
import { UI_DSL_VERSION, uiSpecificationSchema } from "./generative-ui/schemas/ui-specification.js";

export const CONTRACT_VERSION = UI_DSL_VERSION;
const versionField = { version: z.literal(CONTRACT_VERSION) };
const revisionSchema = z.number().int().min(0).max(1_000_000);
const identifierSchema = z.string().uuid();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dataRegistryContractSchema = z.object({
  ...versionField,
  revision: revisionSchema,
  data: dataRegistrySchema,
}).strict();

export const uiEventValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(80)).max(100),
  z.object({ start: z.string().max(10), end: z.string().max(10) }).strict(),
  z.null(),
]);

export const uiEventSchema = z.object({
  ...versionField,
  correlationId: identifierSchema,
  sessionId: identifierSchema,
  interfaceRevision: revisionSchema,
  dataRevision: revisionSchema,
  dataKeys: z.array(z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).max(20),
  currentSpecification: uiSpecificationSchema.optional(),
  event: z.object({
    name: interactionEventNameSchema,
    sourceId: nodeIdSchema,
    value: uiEventValueSchema.optional(),
    formValues: z.record(nodeIdSchema, z.string().max(500))
      .refine((fields) => Object.keys(fields).length > 0 && Object.keys(fields).length <= 12)
      .optional(),
  }).strict(),
}).strict().superRefine((input, context) => {
  if (input.event.formValues !== undefined && input.event.name !== "form.submit") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["event", "formValues"], message: "Los campos completos sólo pertenecen a form.submit" });
  }
});

export const sessionReferenceSchema = z.object({
  interfaceRevision: revisionSchema,
  dataRevision: revisionSchema,
  dataKeys: z.array(z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).max(20),
}).strict();

export const agentStatusSchema = z.object({
  ...versionField,
  stage: z.enum(["connecting", "thinking", "retrieving_data", "generating_ui", "updating", "ready"]),
  message: z.string().trim().min(1).max(200),
}).strict();

export const errorPayloadSchema = z.object({
  ...versionField,
  code: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  message: z.string().trim().min(1).max(240),
  recoverable: z.boolean(),
  hasPartialData: z.boolean().default(false),
  correlationId: identifierSchema.optional(),
}).strict();

const streamBase = {
  ...versionField,
  streamId: identifierSchema,
  correlationId: identifierSchema,
  sequence: z.number().int().positive(),
};

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ ...streamBase, type: z.literal("started"), sessionId: identifierSchema }).strict(),
  z.object({ ...streamBase, type: z.literal("status"), status: agentStatusSchema }).strict(),
  z.object({
    ...streamBase,
    type: z.literal("data-available"),
    key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    value: dataValueSchema,
  }).strict(),
  z.object({ ...streamBase, type: z.literal("data-patch"), patch: dataPatchSchema }).strict(),
  z.object({
    ...streamBase,
    type: z.literal("ui"),
    specification: uiSpecificationSchema,
    dataRegistry: dataRegistryContractSchema,
  }).strict(),
  z.object({ ...streamBase, type: z.literal("ui-patch"), patch: uiPatchSchema }).strict(),
  z.object({ ...streamBase, type: z.literal("completed"), interfaceRevision: revisionSchema }).strict(),
  z.object({ ...streamBase, type: z.literal("cancelled"), hasPartialData: z.boolean() }).strict(),
  z.object({ ...streamBase, type: z.literal("error"), error: errorPayloadSchema }).strict(),
]);

export const systemStatusSchema = z.object({
  ...versionField,
  contractFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["ok", "degraded", "unavailable"]),
  backend: z.enum(["ready", "unavailable"]),
  agent: z.enum(["ready", "unavailable"]),
  mcp: z.enum(["ready", "unavailable"]),
  checkedAt: z.string().datetime(),
}).strict();

export const financialSummaryRequestSchema = z.object({
  ...versionField,
  correlationId: identifierSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict();

export const financialSummaryResponseSchema = z.object({
  ...versionField,
  correlationId: identifierSchema,
  dataRegistry: dataRegistryContractSchema,
}).strict();

const textAgentRequestBase = {
  ...versionField,
  sessionId: identifierSchema,
  correlationId: identifierSchema,
  provider: z.enum(["google", "openai"]),
  responseMode: z.enum(["text", "complete-ui"]).default("complete-ui"),
  uiPlanner: z.unknown().optional(),
  repair: z.unknown().optional(),
};

export const textAgentRequestSchema = z.union([
  z.object({
    ...textAgentRequestBase,
    query: z.string().trim().min(1).max(2_000),
    sessionState: sessionReferenceSchema.optional(),
  }).strict(),
  z.object({
    ...textAgentRequestBase,
    uiEvent: uiEventSchema,
  }).strict(),
]);

const textStreamBase = {
  ...versionField,
  sessionId: identifierSchema,
  correlationId: identifierSchema,
  sequence: z.number().int().positive(),
};

export const textAgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ ...textStreamBase, type: z.literal("started") }).strict(),
  z.object({ ...textStreamBase, type: z.literal("status"), status: agentStatusSchema }).strict(),
  z.object({
    ...textStreamBase,
    type: z.literal("data-available"),
    key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    value: dataValueSchema,
  }).strict(),
  z.object({ ...textStreamBase, type: z.literal("data-patch"), patch: dataPatchSchema }).strict(),
  z.object({ ...textStreamBase, type: z.literal("text-delta"), delta: z.string().min(1).max(8_000) }).strict(),
  z.object({
    ...textStreamBase,
    type: z.literal("ui"),
    specification: uiSpecificationSchema,
    dataRegistry: dataRegistryContractSchema,
  }).strict(),
  z.object({
    ...textStreamBase,
    type: z.literal("ui-started"),
    specification: uiSpecificationSchema,
    dataRegistry: dataRegistryContractSchema,
    revision: revisionSchema,
  }).strict(),
  z.object({ ...textStreamBase, type: z.literal("ui-patch"), patch: uiPatchSchema }).strict(),
  z.object({ ...textStreamBase, type: z.literal("ui-completed"), revision: revisionSchema }).strict(),
  z.object({
    ...textStreamBase,
    type: z.literal("metrics"),
    agentLatencyMs: z.number().int().nonnegative(),
    mcpLatencyMs: z.number().int().nonnegative(),
    dataLatencyMs: z.number().int().nonnegative(),
    uiPlanningLatencyMs: z.number().int().nonnegative(),
    timeToFirstUiMs: z.number().int().nonnegative(),
    timeToFirstUsefulUiMs: z.number().int().nonnegative(),
    totalGenerationMs: z.number().int().nonnegative(),
  }).strict(),
  z.object({ ...textStreamBase, type: z.literal("completed") }).strict(),
  z.object({ ...textStreamBase, type: z.literal("cancelled"), hasPartialData: z.boolean() }).strict(),
  z.object({ ...textStreamBase, type: z.literal("error"), error: errorPayloadSchema }).strict(),
]);

export type DataRegistry = z.infer<typeof dataRegistryContractSchema>;
export type UIEvent = z.infer<typeof uiEventSchema>;
export type SessionReference = z.infer<typeof sessionReferenceSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type FinancialSummaryRequest = z.infer<typeof financialSummaryRequestSchema>;
export type FinancialSummaryResponse = z.infer<typeof financialSummaryResponseSchema>;
export type TextAgentRequest = z.infer<typeof textAgentRequestSchema>;
export type TextAgentStreamEvent = z.infer<typeof textAgentStreamEventSchema>;
