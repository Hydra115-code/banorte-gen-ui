import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { personalBankingFixture } from "../src/features/generative-ui/fixtures/f0-contract-fixtures.ts";
import { controlCompatibilityKey } from "../src/features/generative-ui/interactions/reconciliation/control-compatibility-key.ts";
import {
  appendChange,
  describeUIPatch,
  summarizeSpecificationChange,
} from "../src/features/generative-ui/patches/ui-change-summary.ts";

test("describe los cinco tipos de patch sin exponer payloads financieros", () => {
  const specification = personalBankingFixture.specification;
  const descriptions = [
    describeUIPatch({ version: "1", baseRevision: 0, revision: 1, op: "update", target: "personal-title", changes: { content: "Nuevo título" } }, specification),
    describeUIPatch({ version: "1", baseRevision: 1, revision: 2, op: "add", target: "personal-root", node: { type: "text", id: "new-copy", content: "Detalle" } }, specification),
    describeUIPatch({ version: "1", baseRevision: 2, revision: 3, op: "replace", target: "personal-title", node: { type: "heading", id: "personal-title", content: "Reemplazo" } }, specification),
    describeUIPatch({ version: "1", baseRevision: 3, revision: 4, op: "move", target: "personal-title", parent: "personal-root" }, specification),
    describeUIPatch({ version: "1", baseRevision: 4, revision: 5, op: "remove", target: "personal-title" }, specification),
  ];
  assert.deepEqual(descriptions.map((item) => item.split(" ")[1]), ["actualizó", "agregó", "reemplazó", "reorganizó", "eliminó"]);
});

test("resume reemplazos completos por elementos agregados, actualizados y eliminados", () => {
  const before = personalBankingFixture.specification;
  const after = structuredClone(before);
  if (after.root.type !== "section") throw new Error("fixture inesperado");
  after.root.children = after.root.children
    .filter((node) => node.id !== "personal-subtitle")
    .map((node) => node.id === "personal-title" && node.type === "heading"
      ? { ...node, content: "Nuevo resumen" }
      : node);
  after.root.children.push({ type: "badge", id: "new-badge", label: "Nuevo" });
  assert.deepEqual(summarizeSpecificationChange(before, after), [
    "Se agregaron 1 elemento.",
    "Se actualizaron 2 elementos.",
    "Se eliminaron 1 elemento.",
  ]);
});

test("explica un cambio completo de vertical sin depender del backend", async () => {
  const { financialEducationFixture } = await import("../src/features/generative-ui/fixtures/f0-contract-fixtures.ts");
  const changes = summarizeSpecificationChange(
    personalBankingFixture.specification,
    financialEducationFixture.specification,
  );
  assert.equal(changes.some((item) => item.startsWith("Se agregaron")), true);
  assert.equal(changes.some((item) => item.startsWith("Se eliminaron")), true);
});

test("deduplica y limita el resumen de cambios sucesivos", () => {
  let items: string[] = [];
  for (const item of ["A", "B", "A", "C", "D"]) items = appendChange(items, item, 3);
  assert.deepEqual(items, ["A", "C", "D"]);
});

test("conserva estado ante cambios cosméticos y lo reconcilia ante contratos incompatibles", () => {
  const base = {
    type: "input" as const,
    id: "goal-name",
    label: "Meta",
    event: "goal.name.changed",
    initialValue: "Ahorro",
    validation: { required: true, maxLength: 40 },
  };
  assert.equal(controlCompatibilityKey(base), controlCompatibilityKey({
    ...base,
    label: "Nombre de la meta",
    helpText: "Escribe un nombre",
  }));
  assert.notEqual(controlCompatibilityKey(base), controlCompatibilityKey({
    ...base,
    validation: { required: true, maxLength: 20 },
  }));
});

test("el runtime conecta claves compatibles y reconciliación de foco", () => {
  const renderer = readFileSync(new URL("../src/features/generative-ui/runtime/LayoutRenderer.tsx", import.meta.url), "utf8");
  const provider = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  const uiRenderer = readFileSync(new URL("../src/features/generative-ui/renderer/UIRenderer.tsx", import.meta.url), "utf8");
  assert.equal([...renderer.matchAll(/key=\{controlCompatibilityKey\(node\)\}/gu)].length, 10);
  assert.match(provider, /captureGeneratedUIFocus/u);
  assert.match(provider, /restoreGeneratedUIFocusAfterCommit/u);
  assert.match(provider, /part\.data\.stage === "ready"[\s\S]*commitPendingChanges/u);
  assert.match(uiRenderer, /data-generated-ui-root/u);
});
