import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DataRevisionGuard } from "../src/features/agent/server/data-revision-guard.ts";
import { createDataRegistryPatchState, applyDataRegistryPatch } from "../src/features/generative-ui/data-binding/registry/data-registry-patch-engine.ts";
import { createUIPatchState, applyUIPatch } from "../src/features/generative-ui/patches/ui-patch-engine.ts";
import { continuitySpecification, continuityTitlePatch } from "../src/features/generative-ui/fixtures/f8-continuity-fixture.ts";

test("las revisiones de datos avanzan una a una y rechazan duplicados y saltos sin mutar", () => {
  const guard = new DataRevisionGuard({ interfaceRevision: 4, dataRevision: 4, dataKeys: ["accounts"] });
  const patch = { version: "1", baseRevision: 4, revision: 5, op: "update", key: "accounts", value: [] };
  assert.equal(guard.apply(patch), true);
  assert.equal(guard.apply(patch), false);
  assert.equal(guard.apply({ ...patch, baseRevision: 5, revision: 7 }), false);
  assert.deepEqual(guard.snapshot(), { revision: 5, keys: ["accounts"] });
  assert.equal(guard.apply({ ...patch, baseRevision: 5, revision: 6, key: "missing" }), false);
});

test("varios patches del mismo turno conservan UI y datos con revisiones independientes", () => {
  let data = createDataRegistryPatchState();
  for (const patch of [
    { version: "1", baseRevision: 0, revision: 1, op: "add", key: "projection", value: 8000 },
    { version: "1", baseRevision: 1, revision: 2, op: "update", key: "projection", value: 9000 },
  ]) {
    const applied = applyDataRegistryPatch(data, patch);
    if (!applied.success) throw new Error(applied.error.code);
    data = applied.state;
  }
  const initial = createUIPatchState(continuitySpecification);
  if (!initial.success) throw new Error("Invalid UI");
  const updated = applyUIPatch(initial.state, continuityTitlePatch);
  if (!updated.success) throw new Error(updated.error.code);
  assert.equal(updated.state.revision, 1);
  assert.equal(data.revision, 2);
  assert.equal(data.data.projection, 9000);
  const stale = applyUIPatch(updated.state, continuityTitlePatch);
  assert.equal(stale.success, false);
  assert.equal(stale.state, updated.state);
});

test("una UI dependiente espera sus datos y respeta bindings de repeat", () => {
  const guard = new DataRevisionGuard();
  const node = { type: "metric", value: { path: "projection.total", expectedType: "number" } };
  assert.equal(guard.dependenciesReady(node), false);
  assert.equal(guard.apply({ version: "1", op: "add", key: "projection", value: { total: 9000 }, baseRevision: 0, revision: 1 }), true);
  assert.equal(guard.dependenciesReady(node), true);
  assert.equal(guard.dependenciesReady({ value: { path: "$item.amount" } }), true);
});

test("un conflicto bloquea patches y nuevas solicitudes sin repetir acciones", () => {
  const session = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/features/agent/server/stream-planned-agent.ts", import.meta.url), "utf8");
  assert.match(session, /if \(synchronizationBlockedRef\.current &&/u);
  assert.match(session, /conflictedSessionIdsRef\.current\.has\(snapshot\.id\)/u);
  assert.match(session, /setCanRetry\(presentation\.canRetry\)/u);
  assert.match(session, /const sendPrompt[\s\S]*?if \(synchronizationBlockedRef\.current\)/u);
  assert.match(server, /!dataGuard\.apply\(event\.patch\)/u);
  assert.match(server, /code: "data_revision_conflict"/u);
});
