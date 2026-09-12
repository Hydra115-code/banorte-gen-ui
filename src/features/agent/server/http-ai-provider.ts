import "server-only";

import { streamAgent } from "./agent-api-client";
import type { AgentApiConfig } from "./agent-api-config";
import type { AIProvider, AIProviderId, AIProviderRequest } from "./ai-provider";

export class HttpAIProvider implements AIProvider {
  constructor(
    readonly id: AIProviderId,
    private readonly config: AgentApiConfig,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  stream(request: AIProviderRequest) {
    return this.streamEvents(request);
  }

  private async *streamEvents(request: AIProviderRequest) {
    for await (const event of streamAgent({
      config: this.config,
      request: {
        version: "1",
        sessionId: request.sessionId,
        correlationId: request.correlationId,
        provider: this.id,
        responseMode: "complete-ui",
        uiPlanner: request.planner,
        ...(request.sessionState ? { sessionState: request.sessionState } : {}),
        ...(request.input.type === "prompt"
          ? { query: request.input.prompt }
          : { uiEvent: request.input.intent }),
        ...(request.repair ? { repair: request.repair } : {}),
      },
      signal: request.signal,
      fetchImplementation: this.fetchImplementation,
    })) {
      if (!("version" in event)) {
        yield event;
      } else if (event.type === "status") {
        yield { type: "status" as const, stage: event.status.stage, message: event.status.message };
      } else if (event.type === "text-delta") {
        yield { type: "text-delta" as const, delta: event.delta };
      } else if (event.type === "data-available") {
        yield { type: "data-available" as const, key: event.key, value: event.value };
      } else if (event.type === "data-patch") {
        yield { type: "data-patch" as const, patch: event.patch };
      } else if (event.type === "ui") {
        yield {
          type: "ui" as const,
          specification: event.specification,
          data: event.dataRegistry.data,
        };
      } else if (event.type === "ui-started") {
        yield {
          type: "ui-started" as const,
          specification: event.specification,
          data: event.dataRegistry.data,
          revision: event.revision,
        };
      } else if (event.type === "ui-patch") {
        yield { type: "ui-patch" as const, patch: event.patch };
      } else if (event.type === "ui-completed") {
        yield { type: "ui-completed" as const, revision: event.revision };
      } else if (event.type === "metrics") {
        yield {
          type: "performance" as const,
          correlationId: event.correlationId,
          agentLatencyMs: event.agentLatencyMs,
          mcpLatencyMs: event.mcpLatencyMs,
          dataLatencyMs: event.dataLatencyMs,
          uiPlanningLatencyMs: event.uiPlanningLatencyMs,
          timeToFirstUiMs: event.timeToFirstUiMs,
          timeToFirstUsefulUiMs: event.timeToFirstUsefulUiMs,
          totalGenerationMs: event.totalGenerationMs,
        };
      } else if (event.type === "error") {
        yield {
          type: "error" as const,
          code: event.error.code,
          message: event.error.message,
          recoverable: event.error.recoverable,
          hasPartialData: event.error.hasPartialData,
          correlationId: event.correlationId,
        };
      } else if (event.type === "completed" || event.type === "cancelled") {
        yield { type: "done" as const };
      }
    }
  }
}
