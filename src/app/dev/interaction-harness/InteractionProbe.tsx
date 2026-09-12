"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIEvent, UISpecification } from "@banorte/contracts";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import type { LocalUIEvent } from "@/features/generative-ui/interactions/events/local-ui-event";
import { classifyInteractionEvent } from "@/features/agent/interactions/interaction-policy";
import { InteractionRequestRegistry } from "@/features/agent/interactions/interaction-request-registry";

const specification: UISpecification = {
  version: "1",
  root: {
    type: "section",
    id: "interaction-probe-root",
    ariaLabel: "Prueba de interacción",
    children: [
      { type: "heading", id: "interaction-probe-title", content: "Coordinación de eventos", level: 2 },
      { type: "button", id: "interaction-probe-button", label: "Actualizar análisis", event: "account.refresh.requested" },
    ],
  },
};

const correlationId = "00000000-0000-4000-8000-000000000011";

function intentFrom(event: LocalUIEvent): UIEvent {
  return {
    version: "1",
    correlationId,
    sessionId: "00000000-0000-4000-8000-000000000012",
    interfaceRevision: 2,
    dataRevision: 3,
    dataKeys: [],
    currentSpecification: specification,
    event: event.value === undefined
      ? { name: event.name, sourceId: event.sourceId }
      : { name: event.name, sourceId: event.sourceId, value: event.value },
  };
}

export function InteractionProbe() {
  const registryRef = useRef(new InteractionRequestRegistry());
  const acceptedRef = useRef(0);
  const lastIntentRef = useRef<UIEvent | undefined>(undefined);
  const [pendingNodeIds, setPendingNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [result, setResult] = useState("Ejecutando doble clic…");

  const onEvent = useCallback((event: LocalUIEvent) => {
    const intent = intentFrom(event);
    lastIntentRef.current = intent;
    if (!registryRef.current.begin(intent)) return;
    acceptedRef.current += 1;
    setPendingNodeIds((current) => new Set(current).add(event.sourceId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startFrame = requestAnimationFrame(() => {
      const button = document.getElementById("interaction-probe-button");
      if (!(button instanceof HTMLButtonElement)) {
        setResult("Falló: el botón no se renderizó.");
        return;
      }
      button.click();
      button.click();

      requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      const intent = lastIntentRef.current;
      const pendingWrapper = button.closest(".ui-runtime-node");
      const atomicDeduplication = acceptedRef.current === 1
        && pendingWrapper?.getAttribute("aria-busy") === "true";
      const rejectsStale = registryRef.current.settle(button.id, "00000000-0000-4000-8000-000000000099") === false;
      const settlesCurrent = intent ? registryRef.current.settle(button.id, intent.correlationId) : false;
      setPendingNodeIds(new Set());
      const retriesSameIntent = intent ? registryRef.current.begin(intent) : false;
      if (intent) registryRef.current.settle(button.id, intent.correlationId);
      const protectsPayment = classifyInteractionEvent("payment.confirm.requested").delivery === "blocked";
      const permitsSimulation = classifyInteractionEvent("savings.monthly.changed").delivery === "agent";

        requestAnimationFrame(() => setResult(
          atomicDeduplication && rejectsStale && settlesCurrent && retriesSameIntent && protectsPayment && permitsSimulation
            ? "Correcto: doble clic deduplicado, respuesta correlacionada y reintento seguro."
            : `Falló: dedup=${atomicDeduplication}, stale=${rejectsStale}, settle=${settlesCurrent}, retry=${retriesSameIntent}, pago=${protectsPayment}, simulación=${permitsSimulation}.`,
        ));
      }));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(startFrame);
    };
  }, []);

  return (
    <main style={{ maxWidth: "48rem", margin: "3rem auto", padding: "1rem" }}>
      <p role="status">{result}</p>
      <UIRenderer onEvent={onEvent} pendingNodeIds={pendingNodeIds} specification={specification} />
    </main>
  );
}
