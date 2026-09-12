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
import {
  CompleteUICollectionError,
  CompleteUICollector,
} from "@/features/agent/server/complete-ui-collector";
import { getConfiguredAIProvider } from "@/features/agent/server/ai-provider-registry";
import { streamPlannedAgent } from "@/features/agent/server/stream-planned-agent";
import { readSessionCookies } from "@/features/auth/server/session-cookies";
import { MAX_AGENT_REQUEST_BYTES } from "@/shared/security/request-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const I5_TIMEOUT_MS = 60_000;
const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(8),
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
  const timeoutSignal = AbortSignal.timeout(I5_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeoutSignal]);
  const stream = createUIMessageStream<AgentUIMessage>({
    execute: async ({ writer }) => {
      const collector = new CompleteUICollector();
      let textOpen = false;
      let failed = false;
      writer.write({ type: "data-session", data: { id: parsed.sessionId, correlationId: parsed.correlationId }, transient: true });
      writer.write({ type: "data-trace", data: { correlationId: parsed.correlationId }, transient: true });
      writer.write({ type: "data-status", data: { stage: "connecting", message: "Conectando con el agente" }, transient: true });
      try {
        for await (const event of streamPlannedAgent({
          accessToken,
          provider,
          prompt: parsed.prompt,
          signal,
          sessionId: parsed.sessionId,
          correlationId: parsed.correlationId,
        })) {
          collector.observe(event);
          if (event.type === "status") {
            writer.write({ type: "data-status", data: { stage: event.stage, message: event.message }, transient: true });
          } else if (event.type === "text-delta") {
            if (!textOpen) {
              writer.write({ type: "text-start", id: "i5-agent-answer" });
              textOpen = true;
            }
            writer.write({ type: "text-delta", id: "i5-agent-answer", delta: event.delta });
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
        if (!failed) {
          const result = collector.complete();
          writer.write({ type: "data-ui", data: result.payload });
          writer.write({ type: "data-completeUIEvidence", data: result.evidence });
          writer.write({ type: "data-status", data: { stage: "ready", message: "Interfaz completa validada" }, transient: true });
        }
      } catch (error) {
        if (signal.aborted && !timeoutSignal.aborted) return;
        failed = true;
        const code = error instanceof CompleteUICollectionError
          ? error.code
          : error instanceof AgentApiError
            ? error.code
            : timeoutSignal.aborted
              ? "agent_api_timeout"
              : "agent_ui_unavailable";
        writer.write({
          type: "data-agentError",
          data: {
            code,
            message: timeoutSignal.aborted
              ? "El agente agotó el tiempo para generar la interfaz"
              : "No fue posible obtener una interfaz completa válida",
            recoverable: true,
            correlationId: parsed.correlationId,
          },
        });
      } finally {
        if (textOpen) writer.write({ type: "text-end", id: "i5-agent-answer" });
      }
    },
    onError: () => "No fue posible completar la interfaz generada",
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
  return { prompt: prompt.data, sessionId: input.data.sessionId, correlationId: input.data.correlationId };
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
