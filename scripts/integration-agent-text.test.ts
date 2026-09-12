import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AgentApiError,
  createAgentTransportFailure,
  validateAgentStreamIdentity,
} from "../src/features/agent/server/agent-stream-protocol.ts";

const sessionId = "10000000-0000-4000-8000-000000000001";
const correlationId = "20000000-0000-4000-8000-000000000002";

test("acepta la identidad esperada y rechaza sessionId o correlationId ajenos", () => {
  validateAgentStreamIdentity({ sessionId, correlationId }, { sessionId, correlationId });
  assert.throws(
    () => validateAgentStreamIdentity(
      { sessionId: "30000000-0000-4000-8000-000000000003", correlationId },
      { sessionId, correlationId },
    ),
    (error: unknown) => error instanceof AgentApiError
      && error.code === "agent_stream_identity_mismatch"
      && !error.recoverable,
  );
});

test("distingue cancelación del usuario de timeout y caída de transporte", () => {
  const cancelled = createAgentTransportFailure(true, false);
  assert.equal(cancelled.name, "AbortError");

  const timeout = createAgentTransportFailure(false, true);
  assert.ok(timeout instanceof AgentApiError);
  assert.equal(timeout.code, "agent_api_timeout");

  const unavailable = createAgentTransportFailure(false, false);
  assert.ok(unavailable instanceof AgentApiError);
  assert.equal(unavailable.code, "agent_api_unavailable");
});

test("el transporte usa JWT individual, timeout acotado y correlación contractual", () => {
  const client = readFileSync(new URL("../src/features/agent/server/agent-api-client.ts", import.meta.url), "utf8");
  assert.match(client, /if \(accessToken\) headers\.set\("Authorization", `Bearer \$\{accessToken\}`\)/u);
  assert.match(client, /AbortSignal\.timeout\(Math\.max/u);
  assert.match(client, /validateAgentStreamIdentity\(canonicalEvent, expected\)/u);
});

test("la ruta I4 usa Vercel AI SDK y exige modo texto sin escribir UI", () => {
  const route = readFileSync(new URL("../src/app/api/integration/agent-text/route.ts", import.meta.url), "utf8");
  assert.match(route, /createUIMessageStream/u);
  assert.match(route, /createUIMessageStreamResponse/u);
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.match(route, /responseMode: "text"/u);
  assert.match(route, /signal: agentSignal/u);
  assert.match(route, /registerAgentRequest\(parsed\.sessionId, parsed\.correlationId, accessToken\)/u);
  assert.match(route, /cancelAgentRequest\(input\.data\.sessionId, input\.data\.correlationId, accessToken\)/u);
  assert.match(route, /timeoutMs: I4_TIMEOUT_MS/u);
  assert.doesNotMatch(route, /writer\.write\(\{ type: "data-ui"/u);
  assert.match(route, /suppressedUiEventCount \+= 1/u);
  assert.match(route, /textDeltaCount \+= 1/u);
  assert.doesNotMatch(route, /specification: event\.specification/u);
});

test("el harness envía mediante useChat y expone cancelación", () => {
  const harness = readFileSync(new URL("../src/app/dev/agent-text-harness/AgentTextProbe.tsx", import.meta.url), "utf8");
  assert.match(harness, /useChat<AgentUIMessage>/u);
  assert.match(harness, /DefaultChatTransport<AgentUIMessage>/u);
  assert.match(harness, /api: "\/api\/integration\/agent-text"/u);
  assert.match(harness, /onClick=\{\(\) => void cancelRequest\(\)\}/u);
  assert.match(harness, /Promise\.allSettled\(\[stop\(\), cancellation\]\)/u);
  assert.doesNotMatch(harness, /UIRenderer/u);
});
