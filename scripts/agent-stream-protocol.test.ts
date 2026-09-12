import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentApiError,
  parseCanonicalStreamEvent,
  type CanonicalStreamState,
} from "../src/features/agent/server/agent-stream-protocol.ts";

const sessionId = "11111111-1111-4111-8111-111111111111";
const correlationId = "22222222-2222-4222-8222-222222222222";

function event(sequence: number, extra: Record<string, unknown> = {}) {
  return {
    version: "1",
    sessionId,
    correlationId,
    sequence,
    type: "started",
    ...extra,
  };
}

function expectAgentError(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => {
    assert.equal(error instanceof AgentApiError, true);
    assert.equal((error as AgentApiError).code, code);
    return true;
  });
}

test("acepta secuencias canónicas estrictamente crecientes aunque tengan saltos", () => {
  const state: CanonicalStreamState = {};
  assert.equal(parseCanonicalStreamEvent(event(1), state)?.sequence, 1);
  assert.equal(parseCanonicalStreamEvent(event(3), state)?.sequence, 3);
  assert.equal(state.lastSequence, 3);
});

test("rechaza secuencias duplicadas y regresivas", () => {
  const duplicateState: CanonicalStreamState = {};
  parseCanonicalStreamEvent(event(2), duplicateState);
  expectAgentError(
    () => parseCanonicalStreamEvent(event(2), duplicateState),
    "agent_stream_sequence_invalid",
  );

  const regressiveState: CanonicalStreamState = {};
  parseCanonicalStreamEvent(event(5), regressiveState);
  expectAgentError(
    () => parseCanonicalStreamEvent(event(4), regressiveState),
    "agent_stream_sequence_invalid",
  );
});

test("distingue una versión contractual no soportada", () => {
  expectAgentError(
    () => parseCanonicalStreamEvent(event(1, { version: "2" }), {}),
    "contract_version_unsupported",
  );
});

test("rechaza un evento v1 malformado sin degradarlo al adaptador legado", () => {
  expectAgentError(
    () => parseCanonicalStreamEvent(event(1, { sessionId: "no-es-uuid" }), {}),
    "agent_stream_event_invalid",
  );
});

test("deja los eventos sin versión al adaptador legado", () => {
  assert.equal(parseCanonicalStreamEvent({ type: "done" }, {}), null);
});
