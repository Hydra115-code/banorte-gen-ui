import {
  CONTRACT_VERSION,
  textAgentStreamEventSchema,
  type TextAgentStreamEvent,
} from "@banorte/contracts";

export type AgentApiErrorCode =
  | "agent_api_rejected"
  | "agent_api_timeout"
  | "agent_api_unavailable"
  | "agent_stream_event_invalid"
  | "agent_stream_event_too_large"
  | "agent_stream_format_unsupported"
  | "agent_stream_missing"
  | "agent_stream_identity_mismatch"
  | "agent_stream_sequence_invalid"
  | "agent_stream_too_many_events"
  | "contract_version_unsupported";

export class AgentApiError extends Error {
  readonly code: AgentApiErrorCode;
  readonly recoverable: boolean;

  constructor(
    message: string,
    code: AgentApiErrorCode,
    recoverable = true,
  ) {
    super(message);
    this.name = "AgentApiError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

export interface CanonicalStreamState {
  lastSequence?: number;
}

export function validateAgentStreamIdentity(
  event: Pick<TextAgentStreamEvent, "sessionId" | "correlationId">,
  expected: { sessionId: string; correlationId: string },
) {
  if (event.sessionId !== expected.sessionId || event.correlationId !== expected.correlationId) {
    throw new AgentApiError(
      "El Agent API respondió con una identidad de sesión distinta",
      "agent_stream_identity_mismatch",
      false,
    );
  }
}

export function createAgentTransportFailure(callerAborted: boolean, timeoutAborted: boolean) {
  if (callerAborted) return new DOMException("Solicitud cancelada", "AbortError");
  if (timeoutAborted) return new AgentApiError("El Agent API agotó el tiempo de espera", "agent_api_timeout");
  return new AgentApiError("No fue posible contactar al Agent API", "agent_api_unavailable");
}

function hasVersion(value: unknown): value is Record<string, unknown> & { version: unknown } {
  return typeof value === "object" && value !== null && Object.hasOwn(value, "version");
}

/**
 * Parses canonical contract events and leaves versionless legacy events to the
 * compatibility adapter. Canonical events are always strict: their version
 * must be supported and their sequence must increase within the response.
 */
export function parseCanonicalStreamEvent(
  value: unknown,
  state: CanonicalStreamState,
): TextAgentStreamEvent | null {
  if (!hasVersion(value)) return null;

  if (value.version !== CONTRACT_VERSION) {
    throw new AgentApiError(
      `La versión ${String(value.version)} del contrato no es compatible`,
      "contract_version_unsupported",
      false,
    );
  }

  const parsed = textAgentStreamEventSchema.safeParse(value);
  if (!parsed.success) {
    throw new AgentApiError(
      "El Agent API devolvió un evento inválido",
      "agent_stream_event_invalid",
      false,
    );
  }

  if (state.lastSequence !== undefined && parsed.data.sequence <= state.lastSequence) {
    throw new AgentApiError(
      "El Agent API devolvió eventos fuera de orden",
      "agent_stream_sequence_invalid",
    );
  }

  state.lastSequence = parsed.data.sequence;
  return parsed.data;
}
