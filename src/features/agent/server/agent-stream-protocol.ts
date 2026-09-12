import {
  CONTRACT_VERSION,
  textAgentStreamEventSchema,
  type TextAgentStreamEvent,
} from "@banorte/contracts";

export type AgentApiErrorCode =
  | "agent_api_rejected"
  | "agent_api_unavailable"
  | "agent_stream_event_invalid"
  | "agent_stream_event_too_large"
  | "agent_stream_format_unsupported"
  | "agent_stream_missing"
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
