import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
} from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorPayloadSchema } from "@banorte/contracts";
import {
  agentDataPartSchemas,
  agentPromptSchema,
  type AgentUIMessage,
} from "@/features/agent/contracts/agent-message";
import { AgentApiError } from "@/features/agent/server/agent-api-client";
import { getConfiguredAIProvider } from "@/features/agent/server/ai-provider-registry";
import {
  cancelAgentRequest,
  registerAgentRequest,
  unregisterAgentRequest,
} from "@/features/agent/server/agent-request-registry";
import { UI_PLANNER_CONTEXT } from "@/features/agent/planner/ui-planner";
import { readSessionCookies } from "@/features/auth/server/session-cookies";
import { MAX_AGENT_REQUEST_BYTES } from "@/shared/security/request-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const I4_TIMEOUT_MS = 45_000;
const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(8),
  sessionId: z.string().uuid(),
  correlationId: z.string().uuid(),
}).strict();

const cancellationSchema = z.object({
  sessionId: z.string().uuid(),
  correlationId: z.string().uuid(),
}).strict();

export async function POST(request: NextRequest) {
  const parsed = await parseRequest(request);
  if (!parsed) return routeError(400, "invalid_request", "Solicitud inválida", crypto.randomUUID());

  const { accessToken } = readSessionCookies(request);
  if (!accessToken) {
    return routeError(401, "authentication_required", "Autenticación requerida", parsed.correlationId);
  }
  const provider = getConfiguredAIProvider();
  if (!provider) {
    return routeError(503, "agent_not_configured", "El agente no está configurado", parsed.correlationId);
  }
  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      const requestController = registerAgentRequest(parsed.sessionId, parsed.correlationId, accessToken);
      const agentSignal = AbortSignal.any([request.signal, requestController.signal]);
      let textOpen = false;
      let mcpResultCount = 0;
      let suppressedUiEventCount = 0;
      let textDeltaCount = 0;
      let failed = false;
      writer.write({ type: "data-session", data: { id: parsed.sessionId, correlationId: parsed.correlationId }, transient: true });
      writer.write({ type: "data-trace", data: { correlationId: parsed.correlationId }, transient: true });
      writer.write({ type: "data-status", data: { stage: "connecting", message: "Conectando con el agente" }, transient: true });

      try {
        for await (const event of provider.stream({
          accessToken,
          input: { type: "prompt", prompt: parsed.prompt },
          signal: agentSignal,
          sessionId: parsed.sessionId,
          correlationId: parsed.correlationId,
          planner: UI_PLANNER_CONTEXT,
          responseMode: "text",
          timeoutMs: I4_TIMEOUT_MS,
        })) {
          if (event.type === "status") {
            writer.write({ type: "data-status", data: { stage: event.stage, message: event.message }, transient: true });
          } else if (event.type === "data-patch" || event.type === "data-available") {
            mcpResultCount += 1;
          } else if (event.type === "text-delta") {
            textDeltaCount += 1;
            if (!textOpen) {
              writer.write({ type: "text-start", id: "i4-agent-answer" });
              textOpen = true;
            }
            writer.write({ type: "text-delta", id: "i4-agent-answer", delta: event.delta });
          } else if (event.type === "ui" || event.type === "ui-started" || event.type === "ui-patch" || event.type === "ui-completed") {
            suppressedUiEventCount += 1;
          } else if (event.type === "error") {
            failed = true;
            writer.write({
              type: "data-agentError",
              data: {
                code: event.code,
                message: event.message,
                recoverable: event.recoverable,
                ...(event.hasPartialData === undefined ? {} : { hasPartialData: event.hasPartialData }),
                correlationId: parsed.correlationId,
              },
            });
          }
        }
      } catch (error) {
        if (agentSignal.aborted) return;
        failed = true;
        const agentError = error instanceof AgentApiError ? error : undefined;
        writer.write({
          type: "data-agentError",
          data: {
            code: agentError?.code ?? "agent_text_unavailable",
            message: agentError?.message ?? "No fue posible completar la respuesta textual",
            recoverable: agentError?.recoverable ?? true,
            correlationId: parsed.correlationId,
          },
        });
      } finally {
        if (textOpen) writer.write({ type: "text-end", id: "i4-agent-answer" });
        unregisterAgentRequest(parsed.sessionId, parsed.correlationId, requestController);
      }

      writer.write({
        type: "data-textEvidence",
        data: { responseMode: "text", mcpResultCount, suppressedUiEventCount, textDeltaCount },
      });
      if (!failed) {
        writer.write({ type: "data-status", data: { stage: "ready", message: "Respuesta textual lista" }, transient: true });
      }
    },
    onError: () => "No fue posible completar la consulta textual",
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Correlation-ID": parsed.correlationId,
      "X-Session-ID": parsed.sessionId,
    },
  });
}

export function DELETE(request: NextRequest) {
  const { accessToken } = readSessionCookies(request);
  const correlationId = request.nextUrl.searchParams.get("correlationId") ?? crypto.randomUUID();
  if (!accessToken) {
    return routeError(401, "authentication_required", "Autenticación requerida", correlationId);
  }
  const input = cancellationSchema.safeParse({
    sessionId: request.nextUrl.searchParams.get("sessionId"),
    correlationId: request.nextUrl.searchParams.get("correlationId"),
  });
  if (!input.success) {
    return routeError(400, "invalid_request", "Solicitud inválida", correlationId);
  }
  const cancelled = cancelAgentRequest(input.data.sessionId, input.data.correlationId, accessToken);
  return Response.json({ cancelled }, {
    status: cancelled ? 202 : 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Correlation-ID": input.data.correlationId,
    },
  });
}

async function parseRequest(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_REQUEST_BYTES) return null;
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_AGENT_REQUEST_BYTES) return null;

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
  const input = requestSchema.safeParse(body);
  if (!input.success) return null;
  const messages = await safeValidateUIMessages<AgentUIMessage>({
    messages: input.data.messages,
    dataSchemas: agentDataPartSchemas,
  });
  if (!messages.success) return null;
  const lastMessage = messages.data.at(-1);
  if (lastMessage?.role !== "user") return null;
  const prompt = agentPromptSchema.safeParse(lastMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n"));
  if (!prompt.success) return null;
  return {
    prompt: prompt.data,
    sessionId: input.data.sessionId,
    correlationId: input.data.correlationId,
  };
}

function routeError(status: number, code: string, message: string, correlationId: string) {
  return Response.json(errorPayloadSchema.parse({
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
