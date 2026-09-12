import assert from "node:assert/strict";
import test from "node:test";
import { dataPatchSchema, dataRegistrySchema, uiPatchSchema, uiSpecificationSchema, type UINode } from "@banorte/contracts";
import { classifyInteractionEvent } from "../src/features/agent/interactions/interaction-policy.ts";
import {
  educationFlowPrompts,
  educationInitialData,
  educationInitialSpecification,
  educationRestrictionDataPatches,
  educationRestrictionUIPatches,
  educationSliderReconciliationPatch,
  educationSliderReconciliationUIPatch,
} from "../src/features/generative-ui/fixtures/f6-financial-education-fixtures.ts";

function collectNodes(value: unknown, nodes: UINode[] = []): UINode[] {
  if (!value || typeof value !== "object") return nodes;
  if ("type" in value && typeof value.type === "string") nodes.push(value as UINode);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => collectNodes(item, nodes));
    else if (child && typeof child === "object") collectNodes(child, nodes);
  }
  return nodes;
}

function nodeById(root: UINode, id: string) {
  return collectNodes(root).find((node) => node.id === id);
}

test("el diagnóstico inicial cumple los contratos y abre con una conclusión breve", () => {
  assert.equal(uiSpecificationSchema.safeParse(educationInitialSpecification).success, true);
  assert.equal(dataRegistrySchema.safeParse(educationInitialData).success, true);
  assert.deepEqual(educationFlowPrompts, [
    "Explícame por qué no logro ahorrar.",
    "No puedo reducir renta ni transporte.",
    "Ajusté mi aportación mensual.",
  ]);
  if (educationInitialSpecification.root.type !== "container") throw new Error("raíz inesperada");
  const stack = educationInitialSpecification.root.children[0];
  assert.equal(stack?.type, "stack");
  if (stack?.type === "stack") assert.equal(stack.children[0]?.id, "education-conclusion");
});

test("distingue datos observados, simulación y recomendación", () => {
  const nodes = collectNodes(educationInitialSpecification.root);
  const real = nodeById(educationInitialSpecification.root, "education-real-data");
  const simulation = nodeById(educationInitialSpecification.root, "education-simulation");
  const recommendation = nodeById(educationInitialSpecification.root, "education-recommendation");
  assert.equal(real?.type === "section" ? real.surface : undefined, "primary");
  assert.equal(simulation?.type === "section" ? simulation.surface : undefined, "secondary");
  assert.equal(recommendation?.type === "section" ? recommendation.surface : undefined, "elevated");
  assert.deepEqual(nodes.filter((node) => node.type === "badge").map((node) => node.type === "badge" ? node.label : ""), [
    "Datos observados", "Simulación", "Recomendación",
  ]);
});

test("la evidencia es expandible y toda simulación contiene el aviso obligatorio", () => {
  const nodes = collectNodes(educationInitialSpecification.root);
  const evidence = nodes.find((node) => node.id === "education-evidence");
  assert.equal(evidence?.type, "accordion");
  const disclaimer = nodes.find((node) => node.id === "education-simulation-disclaimer");
  assert.equal(disclaimer?.type, "alert");
  if (disclaimer?.type === "alert") assert.match(disclaimer.message, /no constituye una oferta financiera/iu);
});

test("una restricción escrita sólo cambia recomendación y simulación", () => {
  educationRestrictionUIPatches.forEach((patch) => assert.equal(uiPatchSchema.safeParse(patch).success, true));
  educationRestrictionDataPatches.forEach((patch) => assert.equal(dataPatchSchema.safeParse(patch).success, true));
  assert.ok(educationRestrictionUIPatches.every((patch) => (
    patch.target.startsWith("education-recommendation") || patch.target.startsWith("education-simulation") || patch.target === "education-monthly-saving"
  )));
  assert.equal(educationRestrictionUIPatches.some((patch) => patch.target === "education-real-data"), false);
  const restrictionPatch = educationRestrictionUIPatches.find((patch) => patch.op === "add");
  assert.equal(restrictionPatch?.op, "add");
  if (restrictionPatch?.op === "add") {
    assert.match(JSON.stringify(restrictionPatch.node), /Renta y transporte permanecen sin cambios/u);
  }
  assert.equal(educationRestrictionDataPatches.some((patch) => patch.key === "fixedExpenses"), false);
  const savingPatch = educationRestrictionDataPatches.find((patch) => patch.key === "recommendedMonthlySaving");
  assert.equal(savingPatch?.op === "update" ? savingPatch.value : undefined, 2000);
});

test("el slider se previsualiza localmente y se reconcilia con revisión oficial", () => {
  assert.equal(uiPatchSchema.safeParse(educationSliderReconciliationUIPatch).success, true);
  assert.equal(dataPatchSchema.safeParse(educationSliderReconciliationPatch).success, true);
  const slider = nodeById(educationInitialSpecification.root, "education-monthly-saving");
  assert.equal(slider?.type, "slider");
  if (slider?.type === "slider") {
    assert.deepEqual(classifyInteractionEvent(slider.event), { kind: "simulation", delivery: "agent" });
  }
  assert.equal(educationSliderReconciliationUIPatch.op === "update" ? educationSliderReconciliationUIPatch.changes.initialValue : undefined, 2200);
  assert.equal(educationSliderReconciliationPatch.op === "update" ? educationSliderReconciliationPatch.value : undefined, 32800);
  assert.equal(educationSliderReconciliationPatch.revision, 4);
});

test("la experiencia termina con un siguiente paso concreto y no ejecuta pagos", () => {
  const action = nodeById(educationInitialSpecification.root, "education-next-action");
  assert.equal(action?.type, "button");
  if (action?.type === "button") {
    assert.equal(action.label, "Ajustar escenario");
    assert.deepEqual(classifyInteractionEvent(action.event), { kind: "simulation", delivery: "agent" });
  }
});
