"use client";

import { useEffect, useState } from "react";
import type { UISpecification } from "@banorte/contracts";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import {
  captureGeneratedUIFocus,
  restoreGeneratedUIFocusAfterCommit,
} from "@/features/generative-ui/interactions/reconciliation/focus-reconciliation";

const initialSpecification: UISpecification = {
  version: "1",
  root: {
    type: "section",
    id: "probe-root",
    ariaLabel: "Prueba de continuidad",
    children: [
      { type: "heading", id: "probe-title", content: "Antes del patch", level: 2 },
      { type: "input", id: "probe-input", label: "Meta", event: "probe.value.changed", initialValue: "", validation: { maxLength: 40 } },
    ],
  },
};

function replaceNodes(specification: UISpecification, title: string, maxLength: number, initialValue: string) {
  if (specification.root.type !== "section") return specification;
  return {
    ...specification,
    root: {
      ...specification.root,
      children: specification.root.children.map((node) => {
        if (node.id === "probe-title" && node.type === "heading") return { ...node, content: title };
        if (node.id === "probe-input" && node.type === "input") {
          return { ...node, initialValue, validation: { maxLength } };
        }
        return node;
      }),
    },
  } satisfies UISpecification;
}

export function DynamicUIProbe() {
  const [specification, setSpecification] = useState(initialSpecification);
  const [result, setResult] = useState("Ejecutando patches…");

  useEffect(() => {
    let cancelled = false;
    const input = document.getElementById("probe-input");
    if (!(input instanceof HTMLInputElement)) {
      setResult("Falló: el control inicial no se renderizó.");
      return;
    }

    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, "Meta escrita por la persona");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const stableFocus = captureGeneratedUIFocus();
    setSpecification((current) => replaceNodes(current, "Después del patch cosmético", 40, ""));
    restoreGeneratedUIFocusAfterCommit(stableFocus);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      const stableInput = document.getElementById("probe-input");
      const preserved = stableInput instanceof HTMLInputElement
        && stableInput.value === "Meta escrita por la persona"
        && document.activeElement === stableInput;
      if (!preserved) {
        setResult("Falló: un patch cosmético perdió valor o foco.");
        return;
      }

      const incompatibleFocus = captureGeneratedUIFocus();
      setSpecification((current) => replaceNodes(current, "Después del cambio contractual", 20, "Valor reconciliado"));
      restoreGeneratedUIFocusAfterCommit(incompatibleFocus);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        const reconciledInput = document.getElementById("probe-input");
        const reconciled = reconciledInput instanceof HTMLInputElement
          && reconciledInput.value === "Valor reconciliado"
          && reconciledInput.maxLength === 20
          && document.activeElement === reconciledInput;
        setResult(reconciled
          ? "Correcto: valor y foco sobreviven patches compatibles; los incompatibles se reconcilian."
          : "Falló: el control incompatible no se reconcilió.");
      }));
    }));

    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ maxWidth: "48rem", margin: "3rem auto", padding: "1rem" }}>
      <p role="status">{result}</p>
      <UIRenderer specification={specification} />
    </main>
  );
}
