import assert from "node:assert/strict";
import test from "node:test";
import {
  dataPatchSchema,
  textAgentRequestSchema,
  textAgentStreamEventSchema,
  uiPatchSchema,
  uiSpecificationSchema,
} from "@banorte/contracts";

const sessionId = "11111111-1111-4111-8111-111111111111";
const correlationId = "22222222-2222-4222-8222-222222222222";

const specification = {
  version: "1",
  root: {
    type: "section",
    id: "financial-summary",
    ariaLabel: "Resumen financiero",
    children: [
      {
        type: "heading",
        id: "summary-heading",
        content: "Tu resumen",
        level: 2,
      },
    ],
  },
};

test("el entrypoint raíz expone y valida una solicitud del agente", () => {
  const result = textAgentRequestSchema.safeParse({
    version: "1",
    sessionId,
    correlationId,
    provider: "google",
    responseMode: "complete-ui",
    query: "¿Cómo voy este mes?",
  });

  assert.equal(result.success, true);
});

test("el contrato común valida una UI transmitida por el backend", () => {
  const ui = uiSpecificationSchema.safeParse(specification);
  assert.equal(ui.success, true);

  const event = textAgentStreamEventSchema.safeParse({
    version: "1",
    sessionId,
    correlationId,
    sequence: 1,
    type: "ui-started",
    specification,
    dataRegistry: { version: "1", revision: 0, data: {} },
    revision: 0,
  });

  assert.equal(event.success, true);
});

test("los patches de datos y UI exigen revisiones consecutivas", () => {
  assert.equal(dataPatchSchema.safeParse({
    version: "1",
    baseRevision: 0,
    revision: 1,
    op: "add",
    key: "financialSummary",
    value: { totalIncome: "10000.00", currency: "MXN" },
  }).success, true);

  assert.equal(uiPatchSchema.safeParse({
    version: "1",
    baseRevision: 0,
    revision: 1,
    op: "update",
    target: "summary-heading",
    changes: { content: "Resumen actualizado" },
  }).success, true);

  assert.equal(dataPatchSchema.safeParse({
    version: "1",
    baseRevision: 0,
    revision: 2,
    op: "remove",
    key: "financialSummary",
  }).success, false);
});
