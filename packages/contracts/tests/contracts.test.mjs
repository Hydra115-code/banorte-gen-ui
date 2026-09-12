import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRACT_FINGERPRINT,
  accountSchema,
  financialQueryFixture,
  initialDataRegistryFixture,
  initialUIFixture,
  interactionFixture,
  paymentConfirmationFixture,
  paymentConfirmationRequestSchema,
  paymentIntentSchema,
  paymentPreparationFixture,
  paymentReceiptFixture,
  paymentReceiptSchema,
  sessionReferenceSchema,
  simpleSessionFixture,
  streamFixture,
  textAgentRequestSchema,
  textAgentStreamEventSchema,
  uiEventSchema,
  uiPatchFixture,
  uiPatchSchema,
  uiSpecificationSchema,
} from "../dist/index.js";

test("los nueve fixtures públicos cumplen el contrato canónico", () => {
  assert.ok(sessionReferenceSchema.safeParse(simpleSessionFixture).success);
  assert.ok(textAgentRequestSchema.safeParse(financialQueryFixture).success);
  streamFixture.forEach((event) => assert.ok(textAgentStreamEventSchema.safeParse(event).success));
  assert.ok(uiSpecificationSchema.safeParse(initialUIFixture).success);
  assert.ok(uiPatchSchema.safeParse(uiPatchFixture).success);
  assert.ok(uiEventSchema.safeParse(interactionFixture).success);
  assert.ok(paymentIntentSchema.safeParse(paymentPreparationFixture).success);
  assert.ok(paymentConfirmationRequestSchema.safeParse(paymentConfirmationFixture).success);
  assert.ok(paymentReceiptSchema.safeParse(paymentReceiptFixture).success);
  assert.equal(initialDataRegistryFixture.version, "1");
});

test("el contrato rechaza versiones y revisiones incompatibles", () => {
  assert.equal(textAgentRequestSchema.safeParse({ ...financialQueryFixture, version: "2" }).success, false);
  assert.equal(uiPatchSchema.safeParse({ ...uiPatchFixture, revision: 2 }).success, false);
  assert.match(CONTRACT_FINGERPRINT, /^[a-f0-9]{64}$/);
});

test("los contratos financieros rechazan datos inseguros o ambiguos", () => {
  assert.equal(paymentIntentSchema.safeParse({ ...paymentPreparationFixture, amount: "-1.00" }).success, false);
  assert.equal(paymentConfirmationRequestSchema.safeParse({ ...paymentConfirmationFixture, confirmed: false }).success, false);
  assert.equal(accountSchema.safeParse({
    id: "40000000-0000-4000-8000-000000000001",
    type: "checking",
    status: "active",
    name: "Cuenta",
    currency: "MXN",
    balance: "100.00",
    maskedIdentifier: "1234567890",
  }).success, false);
});
