import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const session = read("../src/features/agent/components/AgentSessionProvider.tsx");
const route = read("../src/app/api/agent/route.ts");
const provider = read("../src/features/agent/server/http-ai-provider.ts");
const policy = read("../src/features/agent/interactions/interaction-policy.ts");
const eventBus = read("../src/features/generative-ui/interactions/events/UIEventProvider.tsx");
const localEvent = read("../src/features/generative-ui/interactions/events/local-ui-event.ts");
const dateRange = read("../src/features/generative-ui/interactions/components/DateRange.tsx");
const select = read("../src/features/generative-ui/interactions/components/Select.tsx");
const slider = read("../src/features/generative-ui/interactions/components/Slider.tsx");
const button = read("../src/features/generative-ui/interactions/components/Button.tsx");
const harness = read("../src/app/dev/ui-interaction-harness/UIInteractionHarness.tsx");

test("el frontend construye un UIEvent contractual con identidad, revisiones y contexto", () => {
  assert.match(session, /version: "1"/u);
  assert.match(session, /sessionId,/u);
  assert.match(session, /interfaceRevision: patchState\.revision/u);
  assert.match(session, /dataRevision: dataStateRef\.current\.revision/u);
  assert.match(session, /dataKeys: Object\.keys\(dataStateRef\.current\.data\)/u);
  assert.match(session, /currentSpecification: patchState\.specification/u);
  assert.match(session, /event: formValues \? \{ name: event\.name, sourceId: event\.sourceId, formValues \} : event\.value === undefined/u);
  assert.doesNotMatch(session, /toolName\s*:/u);
});

test("la interacción viaja sin prompt por Vercel AI SDK y conserva JWT en servidor", () => {
  assert.match(session, /sendMessage\(undefined, \{ body: \{ submittedAt: Date(?:\.now\(\)|[^}]+), uiEvent: intent \} \}\)/u);
  assert.match(route, /input\.type === "ui-event"/u);
  assert.match(route, /initialState: input\.initialState/u);
  assert.match(route, /accessToken,/u);
  assert.match(provider, /uiEvent: request\.input\.intent/u);
});

test("DateRange, Select, Slider y Button emiten eventos semánticos por el bus común", () => {
  assert.match(localEvent, /localUIEventSchema/u);
  assert.match(eventBus, /LocalUIEventBus/u);
  for (const source of [dateRange, select, slider, button]) {
    assert.match(source, /useInteractionEvent\(id, event\)/u);
    assert.match(source, /emit\(/u);
  }
});

test("la política separa eventos visuales, análisis y acciones financieras", () => {
  assert.match(policy, /delivery: "local"/u);
  assert.match(policy, /delivery: "agent"/u);
  assert.match(policy, /delivery: "blocked"/u);
  assert.match(session, /interactionRegistryRef\.current\.begin\(intent\)/u);
  assert.match(session, /isPending\(event\.sourceId\)/u);
  assert.match(route, /status: hasAgentError \? "failed" : "completed"/u);
});

test("el harness L7 usa el AppShell productivo y no contiene una UI financiera fija", () => {
  assert.match(harness, /<AppShell diagnostics=\{<StaleSimulationDiagnostic \/>\} \/>/u);
  assert.match(harness, /\/api\/auth\/session/u);
  assert.doesNotMatch(harness, /UISpecification|paymentCaptureSpecification|simulation\.changed/u);
});
