import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FrameCommitBatcher } from "../src/features/agent/performance/frame-commit-batcher.ts";
import { FrontendPerformanceSampler } from "../src/features/agent/performance/frontend-performance-sampler.ts";
import { buildPerformancePatches, buildPerformanceSpecification } from "../src/features/generative-ui/fixtures/f10-performance-fixture.ts";
import { applyUIPatch, createUIPatchState } from "../src/features/generative-ui/patches/ui-patch-engine.ts";

test("una ráfaga conserva sólo el snapshot más reciente por frame", () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  const commits: number[] = [];
  const batcher = new FrameCommitBatcher<number>(
    (value) => commits.push(value),
    (callback) => { sequence += 1; callbacks.set(sequence, callback); return sequence; },
    (handle) => { callbacks.delete(handle); },
  );
  for (let value = 1; value <= 60; value += 1) batcher.enqueue(value);
  assert.deepEqual(batcher.stats, { commits: 0, enqueued: 60 });
  callbacks.get(1)?.(0);
  assert.deepEqual(commits, [60]);
  assert.deepEqual(batcher.stats, { commits: 1, enqueued: 60 });
});

test("flush y discard nunca reproducen commits obsoletos", () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  const commits: string[] = [];
  const batcher = new FrameCommitBatcher<string>(
    (value) => commits.push(value),
    (callback) => { sequence += 1; callbacks.set(sequence, callback); return sequence; },
    (handle) => { callbacks.delete(handle); },
  );
  batcher.enqueue("vigente");
  assert.equal(batcher.flush(), true);
  batcher.enqueue("obsoleto");
  batcher.discard();
  callbacks.forEach((callback) => callback(0));
  assert.deepEqual(commits, ["vigente"]);
});

test("el sampler calcula percentiles y limita memoria", () => {
  const sampler = new FrontendPerformanceSampler();
  for (let value = 1; value <= 250; value += 1) {
    sampler.recordPatchApply(value / 10);
    sampler.recordPatchToPaint(value);
  }
  sampler.recordRender();
  const summary = sampler.snapshot();
  assert.equal(summary.patchSamples, 200);
  assert.equal(summary.patchApplyP50Ms, 15);
  assert.equal(summary.patchApplyP95Ms, 24);
  assert.equal(summary.patchToPaintP95Ms, 240);
  assert.equal(summary.renderCount, 1);
});

test("el motor indexado cumple p95 menor a 100 ms con 421 nodos", () => {
  let state = createUIPatchState(buildPerformanceSpecification());
  assert.equal(state.success, true);
  if (!state.success) return;
  const sampler = new FrontendPerformanceSampler();
  for (const patch of buildPerformancePatches(60)) {
    const startedAt = performance.now();
    state = applyUIPatch(state.state, patch);
    sampler.recordPatchApply(performance.now() - startedAt);
    assert.equal(state.success, true, `revision ${patch.revision}`);
    if (!state.success) return;
  }
  const summary = sampler.snapshot();
  assert.ok((summary.patchApplyP95Ms ?? Infinity) < 100, `p95=${summary.patchApplyP95Ms}`);
});

test("un update conserva el índice y rechaza cambios que invalidan el nodo", () => {
  const initial = createUIPatchState(buildPerformanceSpecification());
  assert.equal(initial.success, true);
  if (!initial.success) return;

  const valid = applyUIPatch(initial.state, {
    version: "1",
    baseRevision: 0,
    revision: 1,
    op: "update",
    target: "performance-cell-1-1",
    changes: { content: "Actualizado" },
  });
  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.equal(valid.state.nodeIndex, initial.state.nodeIndex);

  const invalid = applyUIPatch(valid.state, {
    version: "1",
    baseRevision: 1,
    revision: 2,
    op: "update",
    target: "performance-cell-1-1",
    changes: { content: 42 },
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.equal(invalid.error.code, "invalid_result");
});

test("el runtime evita revalidación y rerender de ramas confiables", () => {
  const uiRenderer = readFileSync(new URL("../src/features/generative-ui/renderer/UIRenderer.tsx", import.meta.url), "utf8");
  const nodeRenderer = readFileSync(new URL("../src/features/generative-ui/renderer/NodeRenderer.tsx", import.meta.url), "utf8");
  const layoutRenderer = readFileSync(new URL("../src/features/generative-ui/runtime/LayoutRenderer.tsx", import.meta.url), "utf8");
  const runtimeMotion = readFileSync(new URL("../src/features/generative-ui/runtime/RuntimeMotionNode.tsx", import.meta.url), "utf8");
  const eventProvider = readFileSync(new URL("../src/features/generative-ui/interactions/events/UIEventProvider.tsx", import.meta.url), "utf8");
  const provider = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  assert.match(uiRenderer, /isTrustedUISpecification/u);
  assert.match(nodeRenderer, /isTrustedUINode/u);
  assert.match(layoutRenderer, /memo\(function ResolvedNode/u);
  assert.match(layoutRenderer, /memo\(function ResolvedNodeContent/u);
  assert.match(layoutRenderer, /memo\(function ResolvedNode/u);
  assert.match(runtimeMotion, /layout=\{shouldAnimateLayout \? "position" : false\}/u);
  assert.match(eventProvider, /pendingNodeIds = EMPTY_PENDING_NODE_IDS/u);
  assert.match(provider, /FrameCommitBatcher/u);
  assert.match(provider, /startTransition/u);
});
