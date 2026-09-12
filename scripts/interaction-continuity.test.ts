import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AgentUIIntent } from "../src/features/agent/contracts/agent-ui-intent.ts";
import { classifyInteractionEvent } from "../src/features/agent/interactions/interaction-policy.ts";
import {
  InteractionRequestRegistry,
  interactionIntentFingerprint,
} from "../src/features/agent/interactions/interaction-request-registry.ts";
import { personalBankingFixture } from "../src/features/generative-ui/fixtures/f0-contract-fixtures.ts";

function intent(overrides: Partial<AgentUIIntent> = {}): AgentUIIntent {
  return {
    version: "1",
    correlationId: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002",
    interfaceRevision: 2,
    dataRevision: 3,
    dataKeys: ["accounts"],
    currentSpecification: personalBankingFixture.specification,
    event: { name: "account.period.changed", sourceId: "period", value: "month" },
    ...overrides,
  };
}

test("bloquea atómicamente un doble envío del mismo nodo", () => {
  const registry = new InteractionRequestRegistry();
  assert.equal(registry.begin(intent()), true);
  assert.equal(registry.begin(intent({ correlationId: "00000000-0000-4000-8000-000000000003" })), false);
  assert.equal(registry.isPending("period"), true);
});

test("ignora una finalización obsoleta y acepta sólo la correlacionada", () => {
  const registry = new InteractionRequestRegistry();
  registry.begin(intent());
  assert.equal(registry.settle("period", "00000000-0000-4000-8000-000000000099"), false);
  assert.equal(registry.isPending("period"), true);
  assert.equal(registry.settle("period", "00000000-0000-4000-8000-000000000001"), true);
  assert.equal(registry.isPending("period"), false);
});

test("un reintento conserva identidad contractual y puede reabrirse tras liquidar", () => {
  const registry = new InteractionRequestRegistry();
  const original = intent();
  registry.begin(original);
  const fingerprint = registry.pendingFingerprint("period");
  registry.settle("period", original.correlationId);
  assert.equal(registry.begin(original), true);
  assert.equal(registry.pendingFingerprint("period"), fingerprint);
  assert.equal(interactionIntentFingerprint(original), fingerprint);
});

test("la identidad cambia con valor o revisión, pero no depende del correlationId", () => {
  const original = intent();
  assert.equal(interactionIntentFingerprint(original), interactionIntentFingerprint(intent({
    correlationId: "00000000-0000-4000-8000-000000000004",
  })));
  assert.notEqual(interactionIntentFingerprint(original), interactionIntentFingerprint(intent({ interfaceRevision: 4 })));
  assert.notEqual(interactionIntentFingerprint(original), interactionIntentFingerprint(intent({
    event: { ...original.event, value: "year" },
  })));
});

test("separa visuales, simulaciones, análisis y acciones financieras", () => {
  assert.deepEqual(classifyInteractionEvent("form.value.changed"), { kind: "visual", delivery: "local" });
  assert.deepEqual(classifyInteractionEvent("form.submit"), { kind: "analysis", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("ui.tab.changed"), { kind: "visual", delivery: "local" });
  assert.deepEqual(classifyInteractionEvent("ui.section.regenerate"), { kind: "analysis", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("savings.monthly.changed"), { kind: "simulation", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("payment.review.requested"), { kind: "analysis", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("payment.confirm.requested"), { kind: "financial_action", delivery: "blocked" });
  assert.deepEqual(classifyInteractionEvent("transfer.execute_requested"), { kind: "financial_action", delivery: "blocked" });
});

test("el provider usa registro síncrono, correlación y reintento del intent", () => {
  const provider = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /interactionRegistryRef\.current\.begin/u);
  assert.match(provider, /registry\.matches\(part\.data\.sourceId, part\.data\.correlationId\)/u);
  assert.match(provider, /lastInteractionIntentRef\.current/u);
  assert.match(provider, /dispatchAgentInteraction\(intent\)/u);
  assert.match(provider, /classifyInteractionEvent\(event\.name\)/u);
});

test("el diagnóstico obsoleto se limita al harness en desarrollo y a simulaciones de la misma sesión", () => {
  const provider = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /process\.env\.NODE_ENV !== "development" \|\| window\.location\.pathname !== "\/dev\/ui-interaction-harness"/u);
  assert.match(provider, /previous\.sessionId !== sessionIdRef\.current/u);
  assert.match(provider, /classifyInteractionEvent\(previous\.event\.name\)\.kind !== "simulation"/u);
  assert.match(provider, /previous\.interfaceRevision >=/u);
  const events = readFileSync(new URL("../src/features/generative-ui/interactions/events/UIEventProvider.tsx", import.meta.url), "utf8");
  assert.match(events, /parentTextDrafts \?\? textDrafts/u);
  const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");
  assert.match(canvas, /<UIEventProvider key=\{activeAnalysisId\}>/u);
});
