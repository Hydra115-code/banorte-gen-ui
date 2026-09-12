"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { UIEvent } from "@banorte/contracts";
import { classifyInteractionEvent } from "@/features/agent/interactions/interaction-policy";
import { InteractionRequestRegistry } from "@/features/agent/interactions/interaction-request-registry";
import type { LocalUIEvent } from "@/features/generative-ui/interactions/events/local-ui-event";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import {
  paymentCaptureData,
  paymentCaptureSpecification,
  paymentPreparationPrompts,
  paymentRecoverableErrorSpecification,
  paymentReviewData,
  paymentReviewSpecification,
} from "@/features/generative-ui/fixtures/f7-payment-preparation-fixtures";
import styles from "../contract-harness/page.module.css";

const stages = [
  { label: "Captura", prompt: paymentPreparationPrompts[0], specification: paymentCaptureSpecification, data: paymentCaptureData },
  { label: "Revisión", prompt: paymentPreparationPrompts[1], specification: paymentReviewSpecification, data: paymentReviewData },
  { label: "Error recuperable", prompt: paymentPreparationPrompts[2], specification: paymentRecoverableErrorSpecification, data: paymentReviewData },
] as const;

export function PaymentSafetyGallery() {
  const registryRef = useRef(new InteractionRequestRegistry());
  const [activeStage, setActiveStage] = useState(0);
  const [acceptedReviews, setAcceptedReviews] = useState(0);
  const [blockedConfirmations, setBlockedConfirmations] = useState(0);
  const [pendingNodeIds, setPendingNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const stage = stages[activeStage]!;

  const status = useMemo(() => (
    `Seguro: ${acceptedReviews} revisión(es) aceptada(s); ${blockedConfirmations} confirmación(es) bloqueada(s); ningún pago ni comprobante generado.`
  ), [acceptedReviews, blockedConfirmations]);

  const onEvent = useCallback((event: LocalUIEvent) => {
    const policy = classifyInteractionEvent(event.name);
    if (policy.delivery === "blocked") {
      setBlockedConfirmations((value) => value + 1);
      return;
    }
    if (event.name !== "payment.review.requested") return;
    const intent: UIEvent = {
      version: "1",
      correlationId: crypto.randomUUID(),
      sessionId: "00000000-0000-4000-8000-000000000072",
      interfaceRevision: 0,
      dataRevision: 0,
      dataKeys: [],
      currentSpecification: paymentCaptureSpecification,
      event: { name: event.name, sourceId: event.sourceId },
    };
    if (!registryRef.current.begin(intent)) return;
    setAcceptedReviews((value) => value + 1);
    setPendingNodeIds(new Set([event.sourceId]));
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F7 · preparación segura de pagos · contrato v1</p>
        <h1>Captura y revisión sin ejecución simulada</h1>
        <p role="status">{status}</p>
        <nav aria-label="Etapas del flujo" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: "1rem" }}>
          {stages.map((item, index) => (
            <button aria-pressed={activeStage === index} key={item.label} type="button" onClick={() => setActiveStage(index)}>
              {index + 1}. {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className={styles.gallery}>
        <article className={styles.fixture} key={stage.label}>
          <h2>{stage.label}</h2>
          <blockquote>{stage.prompt}</blockquote>
          <UIRenderer
            bindingOptions={{ currency: "MXN", locale: "es-MX" }}
            data={stage.data}
            onEvent={onEvent}
            pendingNodeIds={pendingNodeIds}
            specification={stage.specification}
          />
        </article>
      </div>
    </main>
  );
}
