import assert from "node:assert/strict";
import test from "node:test";
import { type UISpecification } from "@banorte/contracts";
import { collectFormValues } from "../src/features/agent/interactions/form-submission.ts";

const spec: UISpecification = { version: "1", root: { type: "stack", id: "capture", children: [
  { type: "select", id: "origin", label: "Origen", event: "form.value.changed", required: true, options: [{ value: "checking", label: "Principal" }], initialValue: "checking" },
  { type: "select", id: "destination", label: "Destino", event: "form.value.changed", required: true, options: [{ value: "family", label: "Familiar" }] },
  { type: "input", id: "concept", label: "Concepto", event: "form.value.changed", initialValue: "Concepto explícito", validation: { maxLength: 140 } },
  { type: "button", id: "review", label: "Revisar", event: "form.submit" },
] } };
test("L11 bloquea captura incompleta y respeta valores iniciales contractuales", () => {
  assert.equal(collectFormValues(spec, "review", new Map()), null);
  assert.deepEqual(collectFormValues(spec, "review", new Map([["destination", "family"]])), { origin: "checking", destination: "family", concept: "Concepto explícito" });
});
test("L11 usa edición vigente y no transmite campos ajenos al formulario", () => {
  assert.deepEqual(collectFormValues(spec, "review", new Map([["destination", "family"], ["concept", "Editado"], ["foreign", "No enviar"]])), { origin: "checking", destination: "family", concept: "Editado" });
  assert.equal(collectFormValues(spec, "review", new Map([["destination", "invented"]])), null);
  assert.equal(collectFormValues(spec, "unknown", new Map()), null);
});
