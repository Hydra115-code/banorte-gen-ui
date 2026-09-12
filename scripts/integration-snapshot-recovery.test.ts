import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { restoreSessionUiSnapshot } from "../src/features/agent/session/session-ui-snapshot.ts";
import { continuitySpecification } from "../src/features/generative-ui/fixtures/f8-continuity-fixture.ts";

const sessionId = "38000000-0000-4000-8000-000000000001";
const snapshot = { version: "1", sessionId, interfaceRevision: 5, dataRevision: 8,
  dataKeys: ["projection"], specification: continuitySpecification,
  data: { projection: { total: 9000 } }, invalidatedKeys: ["projection"] };

test("snapshot recupera UI, datos y revisiones juntos y permite continuar desde la fuente autoritativa", () => {
  const restored = restoreSessionUiSnapshot(snapshot, sessionId);
  assert.equal(restored.ui.revision, 5);
  assert.equal(restored.data.revision, 8);
  assert.equal(JSON.stringify(restored.data.data), JSON.stringify(snapshot.data));
  assert.equal(restored.data.invalidatedKeys.has("projection"), true);
});

test("snapshot inválido o de otra sesión no puede desbloquear el análisis", () => {
  assert.throws(() => restoreSessionUiSnapshot({ ...snapshot, data: {} }, sessionId));
  assert.throws(() => restoreSessionUiSnapshot({ ...snapshot, invalidatedKeys: ["missing"] }, sessionId));
  assert.throws(() => restoreSessionUiSnapshot(snapshot, "39000000-0000-4000-8000-000000000001"));
});

test("recuperación tardía, fallida o timeout no cambia sesión ni repite una solicitud", () => {
  const source = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  const recovery = source.slice(source.indexOf("const recoverSnapshot ="), source.indexOf("const continueWithPartialData ="));
  assert.match(recovery, /epoch !== recoveryEpochRef\.current \|\| sessionIdRef\.current !== sessionId/u);
  assert.match(recovery, /AbortSignal\.timeout\(12_000\)/u);
  assert.doesNotMatch(recovery, /sendMessage|dispatchAgentInteraction/u);
  assert.ok(recovery.indexOf("restoreSessionUiSnapshot") < recovery.indexOf("synchronizationBlockedRef.current = false"));
});
