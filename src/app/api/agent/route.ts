import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import { sessionReferenceSchema, type SessionReference } from "@banorte/contracts";
import {
  agentDataPartSchemas,
  agentPromptSchema,
  type AgentUIMessage,
} from "@/features/agent/contracts/agent-message";
import { agentUIIntentSchema, type AgentUIIntent } from "@/features/agent/contracts/agent-ui-intent";
import { getConfiguredAIProvider } from "@/features/agent/server/ai-provider-registry";
import { AgentApiError } from "@/features/agent/server/agent-api-client";
import {
  streamPlannedAgent,
  type ValidatedAgentEvent,
} from "@/features/agent/server/stream-planned-agent";
import { createUIPatchState, type UIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { UI_PLANNER_CONTEXT } from "@/features/agent/planner/ui-planner";
import { GenerationObserver } from "@/features/agent/performance/generation-observer";
import { MAX_AGENT_REQUEST_BYTES } from "@/shared/security/request-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(40).optional(),
  uiEvent: z.unknown().optional(),
  sessionId: z.string().uuid().optional(),
  sessionState: z.unknown().optional(),
  submittedAt: z.number().int().nonnegative().max(9_000_000_000_000_000).optional(),
}).strict();

interface RequestObservation {
  promptSubmittedAt: number;
  requestReceivedAt: number;
  requestBytes: number;
}

type AgentRequestInput =
  | ({ type: "prompt"; prompt: string; session?: { id: string; state: SessionReference } } & RequestObservation)
  | ({ type: "ui-event"; intent: AgentUIIntent; initialState: UIPatchState } & RequestObservation);

async function parseAgentRequest(request: Request): Promise<AgentRequestInput | null> {
  const requestReceivedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_REQUEST_BYTES) return null;

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_AGENT_REQUEST_BYTES) return null;

  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return null;
  }

  const parsedRequest = requestSchema.safeParse(json);
  if (!parsedRequest.success) return null;
  const observation = {
    promptSubmittedAt: parsedRequest.data.submittedAt ?? Date.now(),
    requestReceivedAt,
    requestBytes: new TextEncoder().encode(body).byteLength,
  };

  if (parsedRequest.data.uiEvent !== undefined) {
    const intent = agentUIIntentSchema.safeParse(parsedRequest.data.uiEvent);
    if (!intent.success) return null;
    const initialState = createUIPatchState(
      intent.data.currentSpecification,
      intent.data.interfaceRevision,
    );
    if (!initialState.success) return null;
    return { type: "ui-event", intent: intent.data, initialState: initialState.state, ...observation };
  }

  if (!parsedRequest.data.messages) return null;

  const validatedMessages = await safeValidateUIMessages<AgentUIMessage>({
    messages: parsedRequest.data.messages,
    dataSchemas: agentDataPartSchemas,
  });
  if (!validatedMessages.success) return null;

  const lastMessage = validatedMessages.data.at(-1);
  if (lastMessage?.role !== "user") return null;

  const prompt = lastMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");

  const parsedPrompt = agentPromptSchema.safeParse(prompt);
  if (!parsedPrompt.success) return null;
  if (parsedRequest.data.sessionId || parsedRequest.data.sessionState) {
    const state = sessionReferenceSchema.safeParse(parsedRequest.data.sessionState);
    if (!parsedRequest.data.sessionId || !state.success) return null;
    return { type: "prompt", prompt: parsedPrompt.data, session: { id: parsedRequest.data.sessionId, state: state.data }, ...observation };
  }
  return { type: "prompt", prompt: parsedPrompt.data, ...observation };
}

function modelContextFor(input: AgentRequestInput) {
  return input.type === "prompt"
    ? {
      input: { type: "prompt", prompt: input.prompt },
      planner: UI_PLANNER_CONTEXT,
      ...(input.session ? { sessionState: input.session.state } : {}),
    }
    : { input: { type: "ui-event", intent: input.intent }, planner: UI_PLANNER_CONTEXT };
}

function writeAgentEvent(
  writer: UIMessageStreamWriter<AgentUIMessage>,
  event: ValidatedAgentEvent,
  textState: { isOpen: boolean },
) {
  switch (event.type) {
    case "data-requested":
      writer.write({
        type: "data-dataRequest",
        data: { requestId: event.requestId, label: event.label },
        transient: true,
      });
      break;
    case "data-available":
      writer.write({ type: "data-dataAvailable", data: { key: event.key, value: event.value } });
      break;
    case "data-patch":
      writer.write({ type: "data-dataPatch", data: event.patch });
      break;
    case "status":
      writer.write({ type: "data-status", data: { stage: event.stage, message: event.message }, transient: true });
      break;
    case "text-delta":
      if (!textState.isOpen) {
        writer.write({ type: "text-start", id: "agent-answer" });
        textState.isOpen = true;
      }
      writer.write({ type: "text-delta", id: "agent-answer", delta: event.delta });
      break;
    case "ui":
      writer.write({
        type: "data-ui",
        data: { specification: event.specification, ...(event.data ? { data: event.data } : {}) },
      });
      break;
    case "ui-started":
      writer.write({
        type: "data-uiStarted",
        data: {
          specification: event.specification,
          revision: event.revision,
          ...(event.data ? { data: event.data } : {}),
        },
      });
      break;
    case "ui-patch":
      writer.write({ type: "data-uiPatch", data: event.patch });
      break;
    case "ui-completed":
      writer.write({ type: "data-uiCompleted", data: { revision: event.revision } });
      break;
    case "performance":
      writer.write({
        type: "data-performance",
        data: {
          correlationId: event.correlationId,
          agentLatencyMs: event.agentLatencyMs,
          mcpLatencyMs: event.mcpLatencyMs,
          dataLatencyMs: event.dataLatencyMs,
          uiPlanningLatencyMs: event.uiPlanningLatencyMs,
          timeToFirstUiMs: event.timeToFirstUiMs,
          timeToFirstUsefulUiMs: event.timeToFirstUsefulUiMs,
          totalGenerationMs: event.totalGenerationMs,
        },
      });
      break;
    case "error":
      writer.write({
        type: "data-agentError",
        data: {
          code: event.code,
          message: event.message,
          recoverable: event.recoverable,
          ...(event.hasPartialData === undefined ? {} : { hasPartialData: event.hasPartialData }),
          ...(event.correlationId ? { correlationId: event.correlationId } : {}),
        },
      });
      break;
    case "done":
      break;
  }
}

export async function POST(request: Request) {
  const input = await parseAgentRequest(request);
  if (!input) {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const provider = getConfiguredAIProvider();
  if (!provider) {
    return Response.json({ error: "Proveedor de IA no configurado" }, { status: 503 });
  }

  const sessionId = input.type === "prompt" ? (input.session?.id ?? crypto.randomUUID()) : input.intent.sessionId;
  const correlationId = input.type === "prompt" ? crypto.randomUUID() : input.intent.correlationId;
  const observer = new GenerationObserver({
    modelContext: modelContextFor(input),
    promptSubmittedAt: input.promptSubmittedAt,
    requestReceivedAt: input.requestReceivedAt,
    requestBytes: input.requestBytes,
  });

  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      const textState = { isOpen: false };
      observer.markAgentStarted();
      writer.write({ type: "data-trace", data: { correlationId }, transient: true });
      if (input.type === "prompt" && !input.session) {
        writer.write({
          type: "data-session",
          data: { id: sessionId, correlationId },
          transient: true,
        });
      } else if (input.type === "ui-event") {
        writer.write({
          type: "data-interaction",
          data: {
            correlationId: input.intent.correlationId,
            sourceId: input.intent.event.sourceId,
            status: "pending",
          },
          transient: true,
        });
      }
      writer.write({
        type: "data-status",
        data: {
          stage: input.type === "prompt" ? "connecting" : "updating",
          message: input.type === "prompt" ? "Conectando con el agente" : "Aplicando tu cambio",
        },
        transient: true,
      });

      let hasAgentError = false;
      try {
        const agentStream = input.type === "prompt"
          ? streamPlannedAgent({
              provider,
              prompt: input.prompt,
              signal: request.signal,
              sessionId,
              correlationId,
              ...(input.session ? { sessionState: input.session.state } : {}),
            })
          : streamPlannedAgent({
            provider,
            intent: input.intent,
            initialState: input.initialState,
            signal: request.signal,
            sessionId,
            correlationId,
          });
        for await (const event of agentStream) {
          observer.observe(event);
          writeAgentEvent(writer, event, textState);
          if (event.type === "error") hasAgentError = true;
        }
      } catch (error) {
        if (input.type === "ui-event") {
          writer.write({
            type: "data-interaction",
            data: {
              correlationId: input.intent.correlationId,
              sourceId: input.intent.event.sourceId,
              status: "failed",
            },
            transient: true,
          });
        }
        if (!(error instanceof AgentApiError)) throw error;
        hasAgentError = true;
        writer.write({
          type: "data-agentError",
          data: {
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
            correlationId,
          },
        });
      }

      if (textState.isOpen) writer.write({ type: "text-end", id: "agent-answer" });
      writer.write({ type: "data-runtimeDiagnostics", data: observer.snapshot(correlationId) });
      if (input.type === "ui-event") {
        writer.write({
          type: "data-interaction",
          data: {
            correlationId: input.intent.correlationId,
            sourceId: input.intent.event.sourceId,
            status: hasAgentError ? "failed" : "completed",
          },
          transient: true,
        });
      }
    },
    onError: () => "No fue posible completar la consulta",
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
