import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as frontend from "@banorte/contracts";

const backendDist = process.env.BANORTE_BACKEND_CONTRACT_DIST
  ?? resolve(import.meta.dirname, "../../Moc-back/packages/contracts/dist/index.js");
const backend = await import(pathToFileURL(backendDist).href);

function wireRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("frontend y backend publican exactamente el mismo fingerprint", () => {
  assert.equal(frontend.CONTRACT_VERSION, backend.CONTRACT_VERSION);
  assert.equal(frontend.CONTRACT_FINGERPRINT, backend.CONTRACT_FINGERPRINT);
});

test("fixtures emitidos por backend son aceptados por frontend sin adaptación", () => {
  assert.equal(frontend.textAgentRequestSchema.safeParse(wireRoundTrip(backend.financialQueryFixture)).success, true);
  backend.streamFixture.forEach((event) => {
    assert.equal(frontend.textAgentStreamEventSchema.safeParse(wireRoundTrip(event)).success, true);
  });
  assert.equal(frontend.uiSpecificationSchema.safeParse(wireRoundTrip(backend.initialUIFixture)).success, true);
  assert.equal(frontend.dataRegistryContractSchema.safeParse(wireRoundTrip(backend.initialDataRegistryFixture)).success, true);
  assert.equal(frontend.uiPatchSchema.safeParse(wireRoundTrip(backend.uiPatchFixture)).success, true);
  assert.equal(frontend.paymentIntentSchema.safeParse(wireRoundTrip(backend.paymentPreparationFixture)).success, true);
  assert.equal(frontend.paymentReceiptSchema.safeParse(wireRoundTrip(backend.paymentReceiptFixture)).success, true);
});

test("UIEvent emitido por frontend es aceptado por backend sin adaptación", () => {
  const event = frontend.uiEventSchema.parse({
    ...frontend.interactionFixture,
    correlationId: "30000000-0000-4000-8000-000000000001",
    event: { name: "transactions.view", sourceId: "view-transactions" },
    currentSpecification: frontend.initialUIFixture,
  });

  assert.deepEqual(backend.uiEventSchema.parse(wireRoundTrip(event)), event);
});

test("estado y pagos usan el mismo contrato estricto en ambos lados", () => {
  const status = backend.systemStatusSchema.parse({
    version: backend.CONTRACT_VERSION,
    contractFingerprint: backend.CONTRACT_FINGERPRINT,
    status: "ok",
    backend: "ready",
    agent: "ready",
    mcp: "ready",
    checkedAt: "2026-09-12T16:00:00.000Z",
  });
  assert.deepEqual(frontend.systemStatusSchema.parse(wireRoundTrip(status)), status);
  assert.deepEqual(
    frontend.paymentConfirmationRequestSchema.parse(wireRoundTrip(backend.paymentConfirmationFixture)),
    backend.paymentConfirmationFixture,
  );
});
