import type { UIMessage } from "ai";
import { z } from "zod";
import { dataRegistrySchema } from "../../generative-ui/data-binding/schemas/data-registry-schema";
import { dataValueSchema } from "../../generative-ui/data-binding/schemas/data-registry-schema";
import { uiPatchSchema } from "../../generative-ui/patches/ui-patch-schema";
import { uiSpecificationSchema } from "../../generative-ui/schemas/ui-specification";
import { interactionIdSchema } from "../../generative-ui/schemas/interaction-node";
import { dataPatchSchema } from "@banorte/contracts";

export const agentPromptSchema = z.string().trim().min(1).max(2_000);

export const agentStatusSchema = z.object({
  stage: z.enum(["connecting", "thinking", "retrieving_data", "generating_ui", "updating", "ready"]),
  message: z.string().trim().min(1).max(200),
}).strict();

export const agentUIPayloadSchema = z.object({
  specification: uiSpecificationSchema,
  data: dataRegistrySchema.optional(),
}).strict();

export const agentSessionSchema = z.object({
  id: z.string().uuid(),
  correlationId: z.string().uuid(),
}).strict();

export const agentTraceSchema = z.object({
  correlationId: z.string().uuid(),
}).strict();

export const agentDataRequestSchema = z.object({
  requestId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(160),
}).strict();

export const agentDataAvailableSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  value: dataValueSchema,
}).strict();

export const agentUIStartedSchema = z.object({
  specification: uiSpecificationSchema,
  data: dataRegistrySchema.optional(),
  revision: z.number().int().min(0).max(1_000_000),
}).strict();

export const agentUICompletedSchema = z.object({
  revision: z.number().int().min(0).max(1_000_000),
}).strict();

export const agentPerformanceSchema = z.object({
  correlationId: z.string().uuid(),
  agentLatencyMs: z.number().int().nonnegative(),
  mcpLatencyMs: z.number().int().nonnegative(),
  dataLatencyMs: z.number().int().nonnegative(),
  uiPlanningLatencyMs: z.number().int().nonnegative(),
  frontendRenderLatencyMs: z.number().nonnegative().optional(),
  timeToFirstUiMs: z.number().int().nonnegative(),
  timeToFirstUsefulUiMs: z.number().int().nonnegative(),
  totalGenerationMs: z.number().int().nonnegative(),
}).strict();

const milestoneTimestampSchema = z.number().int().nonnegative().max(9_000_000_000_000_000);

export const agentRuntimeDiagnosticsSchema = z.object({
  correlationId: z.string().uuid(),
  milestones: z.object({
    promptSubmittedAt: milestoneTimestampSchema,
    requestReceivedAt: milestoneTimestampSchema,
    firstEventAt: milestoneTimestampSchema.optional(),
    agentStartedAt: milestoneTimestampSchema.optional(),
    firstMcpRequestAt: milestoneTimestampSchema.optional(),
    firstMcpResultAt: milestoneTimestampSchema.optional(),
    uiGenerationStartedAt: milestoneTimestampSchema.optional(),
    firstUiNodeAt: milestoneTimestampSchema.optional(),
    uiCompletedAt: milestoneTimestampSchema.optional(),
  }).strict(),
  requestBytes: z.number().int().nonnegative().max(10_000_000),
  modelContextBytes: z.number().int().nonnegative().max(10_000_000),
  streamedPayloadBytes: z.number().int().nonnegative().max(1_000_000_000),
  estimatedInputTokens: z.number().int().nonnegative().max(10_000_000),
  estimatedOutputTokens: z.number().int().nonnegative().max(250_000_000),
  eventCount: z.number().int().nonnegative().max(1_000),
  uiPatchCount: z.number().int().nonnegative().max(1_000),
}).strict();

export const agentInteractionStateSchema = z.object({
  correlationId: z.string().uuid(),
  sourceId: interactionIdSchema,
  status: z.enum(["pending", "completed", "failed"]),
}).strict();

export const agentErrorSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  message: z.string().trim().min(1).max(240),
  recoverable: z.boolean(),
  hasPartialData: z.boolean().optional(),
  correlationId: z.string().uuid().optional(),
}).strict();

export const agentTextEvidenceSchema = z.object({
  responseMode: z.literal("text"),
  mcpResultCount: z.number().int().nonnegative().max(20),
  suppressedUiEventCount: z.number().int().nonnegative().max(500),
  textDeltaCount: z.number().int().nonnegative().max(10_000),
}).strict();

export const agentCompleteUIEvidenceSchema = z.object({
  deliveryMode: z.literal("complete"),
  dataPatchCount: z.number().int().nonnegative().max(100),
  dataKeys: z.array(z.string().min(1).max(64)).max(100),
  rootType: z.string().min(1).max(40),
  nodeCount: z.number().int().positive().max(500),
  compositionSignature: z.string().min(1).max(500),
  validationResult: z.literal("valid"),
}).strict();

export type AgentCompleteUIEvidence = z.infer<typeof agentCompleteUIEvidenceSchema>;

export type AgentUIData = {
  session: z.infer<typeof agentSessionSchema>;
  trace: z.infer<typeof agentTraceSchema>;
  status: z.infer<typeof agentStatusSchema>;
  dataRequest: z.infer<typeof agentDataRequestSchema>;
  dataAvailable: z.infer<typeof agentDataAvailableSchema>;
  dataPatch: z.infer<typeof dataPatchSchema>;
  ui: z.infer<typeof agentUIPayloadSchema>;
  uiStarted: z.infer<typeof agentUIStartedSchema>;
  uiPatch: z.infer<typeof uiPatchSchema>;
  uiCompleted: z.infer<typeof agentUICompletedSchema>;
  performance: z.infer<typeof agentPerformanceSchema>;
  runtimeDiagnostics: z.infer<typeof agentRuntimeDiagnosticsSchema>;
  interaction: z.infer<typeof agentInteractionStateSchema>;
  agentError: z.infer<typeof agentErrorSchema>;
  textEvidence: z.infer<typeof agentTextEvidenceSchema>;
  completeUIEvidence: z.infer<typeof agentCompleteUIEvidenceSchema>;
};

export type AgentUIMessage = UIMessage<unknown, AgentUIData>;
export type AgentPerformance = z.infer<typeof agentPerformanceSchema>;
export type AgentRuntimeDiagnostics = z.infer<typeof agentRuntimeDiagnosticsSchema>;

export const agentDataPartSchemas = {
  session: agentSessionSchema,
  trace: agentTraceSchema,
  status: agentStatusSchema,
  dataRequest: agentDataRequestSchema,
  dataAvailable: agentDataAvailableSchema,
  dataPatch: dataPatchSchema,
  ui: agentUIPayloadSchema,
  uiStarted: agentUIStartedSchema,
  uiPatch: uiPatchSchema,
  uiCompleted: agentUICompletedSchema,
  performance: agentPerformanceSchema,
  runtimeDiagnostics: agentRuntimeDiagnosticsSchema,
  interaction: agentInteractionStateSchema,
  agentError: agentErrorSchema,
  textEvidence: agentTextEvidenceSchema,
  completeUIEvidence: agentCompleteUIEvidenceSchema,
};
