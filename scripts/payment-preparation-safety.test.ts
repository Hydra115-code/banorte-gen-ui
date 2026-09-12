import assert from "node:assert/strict";
import test from "node:test";
import { dataRegistrySchema, uiSpecificationSchema, type UIEvent, type UINode } from "@banorte/contracts";
import { classifyInteractionEvent } from "../src/features/agent/interactions/interaction-policy.ts";
import { InteractionRequestRegistry } from "../src/features/agent/interactions/interaction-request-registry.ts";
import { maskFinancialIdentifier } from "../src/features/generative-ui/data-binding/formatting/mask-financial-identifier.ts";
import {
  paymentCaptureData,
  paymentCaptureSpecification,
  paymentRecoverableErrorSpecification,
  paymentReviewData,
  paymentReviewSpecification,
} from "../src/features/generative-ui/fixtures/f7-payment-preparation-fixtures.ts";

function collectNodes(value: unknown, nodes: UINode[] = []): UINode[] {
  if (!value || typeof value !== "object") return nodes;
  if ("type" in value && typeof value.type === "string") nodes.push(value as UINode);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => collectNodes(item, nodes));
    else if (child && typeof child === "object") collectNodes(child, nodes);
  }
  return nodes;
}

function labels(specification: typeof paymentReviewSpecification) {
  return collectNodes(specification.root).flatMap((node) => {
    if (node.type === "heading") return [node.content];
    if ("label" in node && typeof node.label === "string") return [node.label];
    return [];
  });
}

test("captura, revisión y error recuperable cumplen el contrato común", () => {
  for (const specification of [paymentCaptureSpecification, paymentReviewSpecification, paymentRecoverableErrorSpecification]) {
    assert.equal(uiSpecificationSchema.safeParse(specification).success, true);
  }
  assert.equal(dataRegistrySchema.safeParse(paymentCaptureData).success, true);
  assert.equal(dataRegistrySchema.safeParse(paymentReviewData).success, true);
});

test("la captura usa textos inequívocos y Revisar pago no es una acción autoritativa", () => {
  assert.ok(labels(paymentCaptureSpecification).includes("Preparar pago"));
  assert.ok(labels(paymentCaptureSpecification).includes("Revisar pago"));
  assert.deepEqual(classifyInteractionEvent("payment.review.requested"), { kind: "analysis", delivery: "agent" });
});

test("la revisión contiene todos los datos financieros requeridos y enmascara la cuenta", () => {
  const required = ["Cuenta de origen", "Beneficiario", "Monto", "Moneda", "Comisión", "Fecha", "Saldo estimado posterior"];
  const reviewLabels = labels(paymentReviewSpecification);
  required.forEach((label) => assert.ok(reviewLabels.includes(label), label));
  assert.equal(maskFinancialIdentifier("accountNumber", paymentReviewData.accountNumber!), "•••• 4567");
  assert.equal(reviewLabels.includes("Aún no realizado"), true);
});

test("confirmar, ejecutar, enviar y reintentar pagos permanecen bloqueados", () => {
  for (const event of ["payment.confirm.requested", "payment.execute.requested", "payment.send.requested", "payment.retry.requested"]) {
    assert.deepEqual(classifyInteractionEvent(event), { kind: "financial_action", delivery: "blocked" }, event);
  }
  assert.deepEqual(classifyInteractionEvent("payment.review.edit_requested"), { kind: "analysis", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("payment.review.cancel_requested"), { kind: "analysis", delivery: "agent" });
  assert.deepEqual(classifyInteractionEvent("payment.cancel.requested"), { kind: "financial_action", delivery: "blocked" });
});

test("el doble clic de revisión sólo acepta un intent", () => {
  const registry = new InteractionRequestRegistry();
  const intent: UIEvent = {
    version: "1",
    correlationId: "00000000-0000-4000-8000-000000000071",
    sessionId: "00000000-0000-4000-8000-000000000072",
    interfaceRevision: 0,
    dataRevision: 0,
    dataKeys: [],
    currentSpecification: paymentCaptureSpecification,
    event: { name: "payment.review.requested", sourceId: "payment-review-button" },
  };
  assert.equal(registry.begin(intent), true);
  assert.equal(registry.begin({ ...intent, correlationId: "00000000-0000-4000-8000-000000000073" }), false);
});

test("el error recuperable conserva los valores y ninguna etapa fabrica éxito o comprobante", () => {
  assert.equal(paymentReviewData.amount, 1250);
  const serialized = JSON.stringify({
    paymentCaptureSpecification,
    paymentReviewSpecification,
    paymentRecoverableErrorSpecification,
    paymentReviewData,
  }).toLocaleLowerCase("es-MX");
  assert.doesNotMatch(serialized, /(?:pago realizado|pago exitoso|receipt|comprobante generado|folio de pago)/u);
  const errorBindings = collectNodes(paymentRecoverableErrorSpecification.root)
    .filter((node) => node.type === "metric")
    .map((node) => node.type === "metric" ? node.valueBinding : "");
  assert.deepEqual(errorBindings.sort(), Object.keys(paymentReviewData).sort());
});
