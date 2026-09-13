import "server-only";

import {
  type SessionReference,
  type TextAgentRequest,
  type TextAgentStreamEvent,
} from "@banorte/contracts";
import { agentApiEventSchema, type AgentApiEvent } from "./agent-api-event";
import {
  AgentApiError,
  createAgentTransportFailure,
  parseCanonicalStreamEvent,
  validateAgentStreamIdentity,
  type CanonicalStreamState,
} from "./agent-stream-protocol";
import type { AgentApiConfig } from "./agent-api-config";
import type { UIPlannerContext, UIRepairContext } from "../planner/ui-planner";
import type { AgentUIIntent } from "../contracts/agent-ui-intent";

const MAX_STREAM_EVENTS = 500;
const MAX_STREAM_LINE_LENGTH = 1_000_000;
const AGENT_TIMEOUT_MS = 120_000;
const allowedContentTypes = ["application/x-ndjson", "application/jsonl", "application/json"];

export { AgentApiError } from "./agent-stream-protocol";

interface AgentApiRequestBase {
  version?: TextAgentRequest["version"];
  sessionId?: TextAgentRequest["sessionId"];
  correlationId?: TextAgentRequest["correlationId"];
  provider: TextAgentRequest["provider"];
  responseMode?: TextAgentRequest["responseMode"];
  sessionState?: SessionReference;
  uiPlanner: UIPlannerContext;
  repair?: UIRepairContext;
}

export type AgentApiRequest = AgentApiRequestBase & (
  | { query: string; uiEvent?: never }
  | { query?: never; uiEvent: AgentUIIntent }
);

interface StreamAgentOptions {
  accessToken?: string;
  config: AgentApiConfig;
  request: AgentApiRequest;
  signal: AbortSignal;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}

export type AgentApiWireEvent = TextAgentStreamEvent | AgentApiEvent;

function parseEventLine(
  line: string,
  streamState: CanonicalStreamState,
  expected: { sessionId: string; correlationId: string },
): AgentApiWireEvent {
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch {
    throw new AgentApiError(
      "El Agent API devolvió un evento inválido",
      "agent_stream_event_invalid",
      false,
    );
  }

  const canonicalEvent = parseCanonicalStreamEvent(value, streamState);
  if (canonicalEvent) {
    validateAgentStreamIdentity(canonicalEvent, expected);
    return canonicalEvent;
  }

  try {
    return agentApiEventSchema.parse(value);
  } catch {
    throw new AgentApiError(
      "El Agent API devolvió un evento inválido",
      "agent_stream_event_invalid",
      false,
    );
  }
}

async function* readEventStream(
  response: Response,
  expected: { sessionId: string; correlationId: string },
): AsyncGenerator<AgentApiWireEvent> {
  if (!response.body) {
    throw new AgentApiError("El Agent API no devolvió un stream", "agent_stream_missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventCount = 0;
  let hasFinished = false;
  const streamState: CanonicalStreamState = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > MAX_STREAM_LINE_LENGTH) {
        throw new AgentApiError(
          "El Agent API excedió el tamaño de evento permitido",
          "agent_stream_event_too_large",
          false,
        );
      }

      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        eventCount += 1;
        if (eventCount > MAX_STREAM_EVENTS) {
          throw new AgentApiError(
            "El Agent API excedió el número de eventos permitido",
            "agent_stream_too_many_events",
            false,
          );
        }
        yield parseEventLine(line, streamState, expected);
      }

      if (done) {
        const finalLine = buffer.trim();
        if (finalLine) yield parseEventLine(finalLine, streamState, expected);
        hasFinished = true;
        break;
      }
    }
  } finally {
    if (!hasFinished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function* streamAgent({
  accessToken,
  config,
  request,
  signal,
  fetchImplementation = fetch,
  timeoutMs = AGENT_TIMEOUT_MS,
}: StreamAgentOptions): AsyncGenerator<AgentApiWireEvent> {
  const timeoutSignal = AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, AGENT_TIMEOUT_MS)));
  const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
  const headers = new Headers({
    Accept: "application/x-ndjson",
    "Content-Type": "application/json",
  });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  else if (config.token) headers.set("Authorization", `Bearer ${config.token}`);
  const normalizedRequest = {
    ...request,
    version: request.version ?? "1",
    sessionId: request.sessionId ?? crypto.randomUUID(),
    correlationId: request.correlationId ?? crypto.randomUUID(),
    responseMode: request.responseMode ?? "complete-ui",
  };

  let response: Response;
  try {
    response = await fetchImplementation(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(normalizedRequest),
      cache: "no-store",
      signal: combinedSignal,
    });
  } catch {
    throw createAgentTransportFailure(signal.aborted, timeoutSignal.aborted);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AgentApiError("La sesión expiró; inicia sesión nuevamente", "authentication_required", false);
    }
    throw new AgentApiError("El Agent API rechazó la solicitud", "agent_api_rejected");
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (!contentType || !allowedContentTypes.includes(contentType)) {
    throw new AgentApiError(
      "El Agent API devolvió un formato no compatible",
      "agent_stream_format_unsupported",
      false,
    );
  }

  try {
    yield* readEventStream(response, {
      sessionId: normalizedRequest.sessionId,
      correlationId: normalizedRequest.correlationId,
    });
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    const failure = createAgentTransportFailure(signal.aborted, timeoutSignal.aborted);
    if (failure instanceof AgentApiError && failure.code === "agent_api_unavailable") {
      throw new AgentApiError("El stream del Agent API se interrumpió", "agent_api_unavailable");
    }
    throw failure;
  }
}
