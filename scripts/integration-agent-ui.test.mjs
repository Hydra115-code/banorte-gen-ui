import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collector = readFileSync(new URL("../src/features/agent/server/complete-ui-collector.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/integration/agent-ui/route.ts", import.meta.url), "utf8");
const harness = readFileSync(new URL("../src/app/dev/agent-ui-harness/AgentUIProbe.tsx", import.meta.url), "utf8");
const planner = readFileSync(new URL("../src/features/agent/server/stream-planned-agent.ts", import.meta.url), "utf8");

test("el colector aplica DataPatch y UIPatch antes de aceptar la revisión final", () => {
  assert.match(collector, /applyDataRegistryPatch\(this\.dataState, event\.patch\)/u);
  assert.match(collector, /applyUIPatch\(this\.uiState, event\.patch\)/u);
  assert.match(collector, /this\.completedRevision !== this\.uiState\.revision/u);
  assert.match(collector, /throw new CompleteUICollectionError\("ui_incomplete"\)/u);
  assert.match(collector, /dataPatchCount/u);
});

test("la ruta I5 autentica, valida todo el stream y sólo entrega la UI final", () => {
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.match(route, /streamPlannedAgent\(\{/u);
  assert.match(route, /accessToken,/u);
  assert.match(route, /const result = collector\.complete\(\)/u);
  assert.match(route, /type: "data-ui", data: result\.payload/u);
  assert.doesNotMatch(route, /type: "data-uiStarted"/u);
  assert.doesNotMatch(route, /type: "data-uiPatch"/u);
});

test("el JWT individual llega al proveedor sin cambiar el modo complete-ui predeterminado", () => {
  assert.match(planner, /accessToken\?: string/u);
  assert.match(planner, /options\.accessToken \? \{ accessToken: options\.accessToken \} : \{\}/u);
  assert.doesNotMatch(route, /responseMode:\s*"text"/u);
});

test("el harness prueba tres prompts sin incluir UISpecification preconstruidas", () => {
  assert.match(harness, /¿Cuánto tengo disponible\?/u);
  assert.match(harness, /¿En qué se me está yendo el dinero\?/u);
  assert.match(harness, /Explícame por qué no logro ahorrar\./u);
  assert.match(harness, /<UIRenderer data=\{data\} specification=\{specification\}/u);
  assert.match(harness, /renderResult: "mounted"/u);
  assert.doesNotMatch(harness, /root:\s*\{/u);
});
