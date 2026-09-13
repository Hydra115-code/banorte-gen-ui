import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  type UIMessageStreamWriter,
} from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorPayloadSchema, sessionReferenceSchema, type SessionReference } from "@banorte/contracts";
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
import { accessTokenNeedsRefresh } from "@/features/auth/server/access-token-expiry";
import {
  clearSessionCookies,
  readSessionCookies,
  writeSessionCookies,
} from "@/features/auth/server/session-cookies";
import {
  refreshSupabaseSession,
  SupabaseAuthenticationError,
  type SupabaseUserSession,
} from "@/features/auth/server/supabase-session";

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

export async function POST(request: NextRequest) {
  const input = await parseAgentRequest(request);
  if (!input) {
    return routeError(400, "invalid_request", "Solicitud inválida", crypto.randomUUID());
  }

  const sessionId = input.type === "prompt" ? (input.session?.id ?? crypto.randomUUID()) : input.intent.sessionId;
  const correlationId = input.type === "prompt" ? crypto.randomUUID() : input.intent.correlationId;
  const cookies = readSessionCookies(request);
  let accessToken = cookies.accessToken;
  let refreshedSession: SupabaseUserSession | undefined;
  if (cookies.refreshToken && (!accessToken || accessTokenNeedsRefresh(accessToken))) {
    try {
      refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
      accessToken = refreshedSession.accessToken;
    } catch (error) {
      const response = routeError(
        error instanceof SupabaseAuthenticationError && error.code === "unavailable" ? 503 : 401,
        error instanceof SupabaseAuthenticationError && error.code === "unavailable"
          ? "authentication_unavailable"
          : "authentication_required",
        error instanceof SupabaseAuthenticationError && error.code === "unavailable"
          ? "No fue posible renovar la sesión"
          : "La sesión expiró; inicia sesión nuevamente",
        correlationId,
      );
      if (!(error instanceof SupabaseAuthenticationError) || error.code !== "unavailable") {
        clearSessionCookies(response);
      }
      return response;
    }
  }
  if (!accessToken) {
    return routeError(401, "authentication_required", "Autenticación requerida", correlationId);
  }

  const provider = getConfiguredAIProvider();
  if (!provider) {
    return routeError(503, "agent_not_configured", "El agente no está configurado", correlationId);
  }

  const observer = new GenerationObserver({
    modelContext: modelContextFor(input),
    promptSubmittedAt: input.promptSubmittedAt,
    requestReceivedAt: input.requestReceivedAt,
    requestBytes: input.requestBytes,
  });

  const createAgentStream = (token: string) => input.type === "prompt"
    ? streamPlannedAgent({
        accessToken: token,
        provider,
        prompt: input.prompt,
        signal: request.signal,
        sessionId,
        correlationId,
        ...(input.session ? { sessionState: input.session.state } : {}),
      })
    : streamPlannedAgent({
        accessToken: token,
        provider,
        intent: input.intent,
        initialState: input.initialState,
        signal: request.signal,
        sessionId,
        correlationId,
      });

  let preparedStream: AsyncGenerator<ValidatedAgentEvent> | undefined;
  let firstEvent: IteratorResult<ValidatedAgentEvent> | undefined;
  let preparationError: unknown;
  if (input.type === "prompt" && cookies.refreshToken && !refreshedSession) {
    preparedStream = createAgentStream(accessToken);
    try {
      firstEvent = await preparedStream.next();
    } catch (error) {
      if (error instanceof AgentApiError && error.code === "authentication_required") {
        try {
          refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
          accessToken = refreshedSession.accessToken;
          preparedStream = createAgentStream(accessToken);
          firstEvent = await preparedStream.next();
        } catch (retryError) {
          if (retryError instanceof SupabaseAuthenticationError) {
            const unavailable = retryError.code === "unavailable";
            const response = routeError(
              unavailable ? 503 : 401,
              unavailable ? "authentication_unavailable" : "authentication_required",
              unavailable ? "No fue posible renovar la sesión" : "La sesión expiró; inicia sesión nuevamente",
              correlationId,
            );
            if (!unavailable) clearSessionCookies(response);
            return response;
          }
          if (retryError instanceof AgentApiError && retryError.code === "authentication_required") {
            const response = routeError(401, "authentication_required", retryError.message, correlationId);
            clearSessionCookies(response);
            return response;
          }
          preparationError = retryError;
        }
      } else {
        preparationError = error;
      }
    }
  }

  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      const textState = { isOpen: false };
      observer.markAgentStarted();
      observer.markFirstEvent();
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
        if (preparationError) throw preparationError;
        const agentStream = preparedStream ?? createAgentStream(accessToken);
        if (firstEvent && !firstEvent.done) {
          observer.observe(firstEvent.value);
          writeAgentEvent(writer, firstEvent.value, textState);
          if (firstEvent.value.type === "error") hasAgentError = true;
        }
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

  const streamResponse = createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Correlation-ID": correlationId,
      "X-Session-ID": sessionId,
    },
  });
  if (!refreshedSession) return streamResponse;

  const response = new NextResponse(streamResponse.body, {
    status: streamResponse.status,
    statusText: streamResponse.statusText,
    headers: streamResponse.headers,
  });
  writeSessionCookies(response, refreshedSession);
  return response;
}

function routeError(status: number, code: string, message: string, correlationId: string) {
  return NextResponse.json(errorPayloadSchema.parse({
    version: "1",
    code,
    message,
    recoverable: status >= 500,
    hasPartialData: false,
    correlationId,
  }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Correlation-ID": correlationId,
    },
  });
}
