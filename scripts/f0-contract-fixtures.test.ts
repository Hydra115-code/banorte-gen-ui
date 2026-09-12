import assert from "node:assert/strict";
import test from "node:test";
import { dataRegistrySchema, uiPatchSchema, uiSpecificationSchema } from "@banorte/contracts";
import {
  f0ContractFixtures,
  personalBankingPatchSequence,
} from "../src/features/generative-ui/fixtures/f0-contract-fixtures.ts";

const expectedNodeTypes = new Set([
  "container", "section", "stack", "grid", "flex", "split", "scrollable", "divider", "tabs", "accordion",
  "text", "heading", "metric", "badge", "alert", "progress", "icon", "list",
  "visualization", "table",
  "button", "input", "numberInput", "select", "multiSelect", "slider", "datePicker", "dateRange",
  "checkbox", "switch", "radioGroup",
  "repeat", "conditional",
]);

function collectNodeTypes(root: Record<string, unknown>) {
  const types = new Set<string>();
  const pending: Record<string, unknown>[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (typeof node.type === "string") types.add(node.type);
    if (Array.isArray(node.children)) pending.push(...node.children as Record<string, unknown>[]);
    if ((node.type === "tabs" || node.type === "accordion") && Array.isArray(node.items)) {
      for (const item of node.items as Array<Record<string, unknown>>) {
        if (Array.isArray(item.children)) pending.push(...item.children as Record<string, unknown>[]);
      }
    }
    if (node.type === "repeat") {
      if (node.template && typeof node.template === "object") pending.push(node.template as Record<string, unknown>);
      if (node.empty && typeof node.empty === "object") pending.push(node.empty as Record<string, unknown>);
    }
    if (node.type === "conditional") {
      if (node.then && typeof node.then === "object") pending.push(node.then as Record<string, unknown>);
      if (node.else && typeof node.else === "object") pending.push(node.else as Record<string, unknown>);
    }
  }
  return types;
}

test("los tres fixtures cumplen UI DSL y Data Registry v1", () => {
  assert.deepEqual(f0ContractFixtures.map((fixture) => fixture.id), [
    "personal-banking",
    "financial-education",
    "payment-preparation",
  ]);
  for (const fixture of f0ContractFixtures) {
    assert.equal(uiSpecificationSchema.safeParse(fixture.specification).success, true, fixture.id);
    assert.equal(dataRegistrySchema.safeParse(fixture.data).success, true, fixture.id);
  }
});

test("el catálogo de fixtures cubre cada tipo de nodo contractual", () => {
  const renderedTypes = new Set<string>();
  for (const fixture of f0ContractFixtures) {
    for (const type of collectNodeTypes(fixture.specification.root as unknown as Record<string, unknown>)) {
      renderedTypes.add(type);
    }
  }
  assert.deepEqual([...renderedTypes].sort(), [...expectedNodeTypes].sort());
});

test("la secuencia representativa incluye los cinco patches y revisiones consecutivas", () => {
  assert.deepEqual(personalBankingPatchSequence.map((patch) => patch.op), ["update", "add", "replace", "move", "remove"]);
  personalBankingPatchSequence.forEach((patch, index) => {
    assert.equal(uiPatchSchema.safeParse(patch).success, true);
    assert.equal(patch.baseRevision, index);
    assert.equal(patch.revision, index + 1);
  });
});

test("rechaza un patch que salta una revisión", () => {
  assert.equal(uiPatchSchema.safeParse({
    ...personalBankingPatchSequence[0],
    revision: 2,
  }).success, false);
});
