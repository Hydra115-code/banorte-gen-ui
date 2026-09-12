import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentAgentFailure } from "../src/features/agent/recovery/agent-error-presentation.ts";
import { continuitySpecification, continuityTitlePatch } from "../src/features/generative-ui/fixtures/f8-continuity-fixture.ts";
import { applyUIPatch, createUIPatchState } from "../src/features/generative-ui/patches/ui-patch-engine.ts";
import { nodeAtIndexedPath } from "../src/features/generative-ui/patches/ui-node-path-index.ts";
import { isTrustedUINode, isTrustedUISpecification } from "../src/features/generative-ui/patches/trusted-ui-specification.ts";

function validInitialState() {
  const result = createUIPatchState(continuitySpecification);
  if (!result.success) throw new Error("fixture inválido");
  return result.state;
}

test("construye un índice nodeId a ruta para todo el árbol", () => {
  const state = validInitialState();
  for (const id of ["continuity-root", "continuity-title", "continuity-input", "continuity-tabs", "continuity-detail", "continuity-accordion", "continuity-scroll"]) {
    const path = state.nodeIndex.get(id);
    assert.ok(path, id);
    assert.equal(nodeAtIndexedPath(state.specification.root, path)?.id, id);
  }
});

test("un patch pequeño conserva referencias de todas las ramas no modificadas", () => {
  const before = validInitialState();
  const result = applyUIPatch(before, continuityTitlePatch);
  assert.equal(result.success, true);
  if (!result.success) return;
  const beforeChildren = before.specification.root.type === "container" ? before.specification.root.children : [];
  const afterChildren = result.state.specification.root.type === "container" ? result.state.specification.root.children : [];
  assert.notEqual(result.state.specification.root, before.specification.root);
  assert.notEqual(afterChildren[0], beforeChildren[0]);
  for (let index = 1; index < beforeChildren.length; index += 1) assert.equal(afterChildren[index], beforeChildren[index]);
  assert.equal(isTrustedUISpecification(result.state.specification), true);
  assert.equal(isTrustedUINode(afterChildren[1]), true);
});

test("un conflicto conserva exactamente el snapshot e índice vigentes", () => {
  const state = validInitialState();
  const result = applyUIPatch(state, { ...continuityTitlePatch, baseRevision: 9, revision: 10 });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.error.code, "version_conflict");
  assert.equal(result.state.specification, state.specification);
  assert.equal(result.state.nodeIndex, state.nodeIndex);
});

test("el conflicto no ofrece reintento ciego ni repite una operación", () => {
  assert.deepEqual(presentAgentFailure({ code: "ui_revision_conflict", recoverable: true, hasPartialData: true }), {
    code: "ui_revision_conflict",
    title: "La interfaz necesita sincronizarse",
    message: "Conservamos la última revisión válida. No repetiremos la operación; la integración debe recuperar el snapshot vigente antes de aceptar más patches.",
    canRetry: false,
    canContinue: true,
  });
});

test("el runtime conserva claves locales y sólo reconcilia estados incompatibles", () => {
  const runtime = readFileSync(new URL("../src/features/generative-ui/runtime/LayoutRenderer.tsx", import.meta.url), "utf8");
  const tabs = readFileSync(new URL("../src/features/generative-ui/primitives/layout/Tabs.tsx", import.meta.url), "utf8");
  const accordion = readFileSync(new URL("../src/features/generative-ui/primitives/layout/Accordion.tsx", import.meta.url), "utf8");
  assert.match(runtime, /key=\{controlCompatibilityKey\(node\)\}/u);
  assert.match(runtime, /id=\{optionalInteractionId\(node\.id, instanceSuffix\)\}/u);
  assert.match(tabs, /items\.some\(\(item\) => item\.value === activeValue\)/u);
  assert.match(accordion, /filter\(\(value\) => available\.has\(value\)\)/u);
});
