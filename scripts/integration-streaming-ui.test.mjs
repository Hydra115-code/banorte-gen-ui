import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/agent/route.ts", import.meta.url), "utf8");
const session = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
const observer = readFileSync(new URL("../src/features/agent/performance/generation-observer.ts", import.meta.url), "utf8");
const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");
const completeRoute = readFileSync(new URL("../src/app/api/integration/agent-ui/route.ts", import.meta.url), "utf8");
const harness = readFileSync(new URL("../src/app/dev/streaming-ui-harness/StreamingUIHarness.tsx", import.meta.url), "utf8");

test("la ruta productiva exige cookie HttpOnly y propaga el JWT individual", () => {
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.match(route, /if \(!accessToken\)/u);
  assert.match(route, /streamPlannedAgent\(\{\s*accessToken: token,/u);
  assert.match(route, /createAgentStream\(accessToken\)/u);
  assert.match(route, /"X-Correlation-ID": correlationId/u);
});

test("Vercel AI SDK transporta estados, datos, UI inicial, patches y cierre tipados", () => {
  const orderedCases = [
    'case "data-patch"',
    'case "status"',
    'case "ui-started"',
    'case "ui-patch"',
    'case "ui-completed"',
    'case "error"',
  ];
  orderedCases.forEach((item) => assert.match(route, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u")));
  assert.match(route, /type: "data-dataPatch"/u);
  assert.match(route, /type: "data-uiStarted"/u);
  assert.match(route, /type: "data-uiPatch"/u);
  assert.match(route, /type: "data-uiCompleted"/u);
});

test("el cliente valida DataPatch antes de renderizar nodos y valida cada revisión UI", () => {
  const dataPatchPosition = session.indexOf('part.type === "data-dataPatch"');
  const uiStartedPosition = session.indexOf('part.type === "data-uiStarted"');
  assert.ok(dataPatchPosition >= 0 && dataPatchPosition < uiStartedPosition);
  assert.match(session, /applyDataRegistryPatch\(dataStateRef\.current, part\.data\)/u);
  assert.match(session, /createUIPatchState\(part\.data\.specification, part\.data\.revision\)/u);
  assert.match(session, /applyUIPatch\(patchStateRef\.current, part\.data\)/u);
  assert.match(session, /patchStateRef\.current\?\.revision !== part\.data\.revision/u);
});

test("mide primer evento, primeros datos, primera UI útil y tiempo total", () => {
  assert.match(observer, /markFirstEvent\(\)/u);
  assert.match(observer, /firstMcpResultAt/u);
  assert.match(observer, /firstUiNodeAt/u);
  assert.match(observer, /uiCompletedAt/u);
  assert.match(canvas, />Primer evento</u);
  assert.match(canvas, />Primeros datos</u);
  assert.match(canvas, />Primera UI útil real</u);
  assert.match(canvas, />Total</u);
});

test("I6 usa el runtime productivo sin hardcodear una especificación y no altera I5", () => {
  assert.match(harness, /<AppShell showDeveloperDiagnostics \/>/u);
  assert.doesNotMatch(harness, /root:\s*\{/u);
  assert.doesNotMatch(completeRoute, /type: "data-uiStarted"/u);
  assert.doesNotMatch(completeRoute, /type: "data-uiPatch"/u);
});
