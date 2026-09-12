"use client";

import { useState } from "react";
import type { UIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { applyUIPatch, createUIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { continuitySpecification, continuityTitlePatch } from "@/features/generative-ui/fixtures/f8-continuity-fixture";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import styles from "../contract-harness/page.module.css";

function initialState(): UIPatchState {
  const result = createUIPatchState(continuitySpecification);
  if (!result.success) throw new Error("Fixture de continuidad inválido");
  return result.state;
}

export function PatchContinuityProbe() {
  const [patchState, setPatchState] = useState(initialState);
  const [result, setResult] = useState("Configura los controles y aplica el patch de título.");

  function applyProbePatch() {
    const input = document.getElementById("continuity-input");
    const selectedTab = document.querySelector<HTMLButtonElement>("[data-generated-node-id='continuity-tabs'] [role='tab'][aria-selected='true']");
    const accordion = document.querySelector<HTMLButtonElement>("[data-generated-node-id='continuity-accordion'] [aria-expanded='true']");
    const scrollable = document.getElementById("continuity-scroll");
    const before = {
      focus: document.activeElement === input,
      inputValue: input instanceof HTMLInputElement ? input.value : undefined,
      selectionStart: input instanceof HTMLInputElement ? input.selectionStart : undefined,
      tab: selectedTab?.textContent,
      accordion: accordion?.textContent,
      scrollTop: scrollable?.scrollTop ?? 0,
    };
    const applied = applyUIPatch(patchState, continuityTitlePatch);
    if (!applied.success) {
      setResult(`Falló: ${applied.error.code}`);
      return;
    }
    setPatchState(applied.state);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const nextInput = document.getElementById("continuity-input");
      const nextSelectedTab = document.querySelector<HTMLButtonElement>("[data-generated-node-id='continuity-tabs'] [role='tab'][aria-selected='true']");
      const nextAccordion = document.querySelector<HTMLButtonElement>("[data-generated-node-id='continuity-accordion'] [aria-expanded='true']");
      const nextScrollable = document.getElementById("continuity-scroll");
      const preserved = before.focus
        && document.activeElement === nextInput
        && nextInput instanceof HTMLInputElement
        && nextInput.value === before.inputValue
        && nextInput.selectionStart === before.selectionStart
        && nextSelectedTab?.textContent === before.tab
        && nextAccordion?.textContent === before.accordion
        && nextScrollable?.scrollTop === before.scrollTop;
      setResult(preserved
        ? "Correcto: foco, edición, tab, acordeón y scroll sobrevivieron al patch ajeno."
        : `Falló: focus=${before.focus && document.activeElement === nextInput}, tab=${nextSelectedTab?.textContent === before.tab}, acordeón=${nextAccordion?.textContent === before.accordion}, scroll=${nextScrollable?.scrollTop === before.scrollTop}.`);
    }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F8 · continuidad visual · contrato v1</p>
        <h1>Un patch pequeño no reinicia la pantalla</h1>
        <p role="status">{result}</p>
        <button
          disabled={patchState.revision > 0}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={applyProbePatch}
        >
          Aplicar patch de título
        </button>
      </header>
      <div className={styles.gallery}>
        <article className={styles.fixture}>
          <UIRenderer specification={patchState.specification} />
        </article>
      </div>
    </main>
  );
}
