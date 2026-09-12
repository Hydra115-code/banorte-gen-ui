import type { AgentUIIntent } from "../contracts/agent-ui-intent.js";

interface PendingInteraction {
  correlationId: string;
  fingerprint: string;
}

function normalizedValue(value: AgentUIIntent["event"]["value"]) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { start: value.start, end: value.end };
  }
  return value;
}

export function interactionIntentFingerprint(intent: AgentUIIntent) {
  return JSON.stringify([
    intent.sessionId,
    intent.interfaceRevision,
    intent.dataRevision,
    intent.event.name,
    intent.event.sourceId,
    normalizedValue(intent.event.value),
  ]);
}

/** Synchronous guard used before React has time to render a pending state. */
export class InteractionRequestRegistry {
  readonly #pendingBySource = new Map<string, PendingInteraction>();

  begin(intent: AgentUIIntent) {
    if (this.#pendingBySource.has(intent.event.sourceId)) return false;
    this.#pendingBySource.set(intent.event.sourceId, {
      correlationId: intent.correlationId,
      fingerprint: interactionIntentFingerprint(intent),
    });
    return true;
  }

  settle(sourceId: string, correlationId: string) {
    const pending = this.#pendingBySource.get(sourceId);
    if (!pending || pending.correlationId !== correlationId) return false;
    this.#pendingBySource.delete(sourceId);
    return true;
  }

  isPending(sourceId: string) {
    return this.#pendingBySource.has(sourceId);
  }

  matches(sourceId: string, correlationId: string) {
    return this.#pendingBySource.get(sourceId)?.correlationId === correlationId;
  }

  pendingFingerprint(sourceId: string) {
    return this.#pendingBySource.get(sourceId)?.fingerprint;
  }

  clear() {
    this.#pendingBySource.clear();
  }
}
