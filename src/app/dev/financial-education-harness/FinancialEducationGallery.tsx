"use client";

import { useState } from "react";
import type { DataRegistryValue, UISpecification, UINode } from "@banorte/contracts";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import { applyUIPatch, createUIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { applyDataRegistryPatch, createDataRegistryPatchState } from "@/features/generative-ui/data-binding/registry/data-registry-patch-engine";
import {
  educationFlowPrompts,
  educationInitialData,
  educationInitialSpecification,
  educationRestrictionDataPatches,
  educationRestrictionUIPatches,
  educationSliderReconciliationPatch,
  educationSliderReconciliationUIPatch,
} from "@/features/generative-ui/fixtures/f6-financial-education-fixtures";
import styles from "../contract-harness/page.module.css";

interface Stage {
  label: string;
  prompt: string;
  specification: UISpecification;
  data: DataRegistryValue;
}

function nodeById(node: UINode, id: string): UINode | undefined {
  if (node.id === id) return node;
  if ("children" in node) {
    for (const child of node.children) {
      const found = nodeById(child, id);
      if (found) return found;
    }
  }
  if (node.type === "tabs" || node.type === "accordion") {
    for (const item of node.items) {
      for (const child of item.children) {
        const found = nodeById(child, id);
        if (found) return found;
      }
    }
  }
  if (node.type === "repeat") return nodeById(node.template, id) ?? (node.empty ? nodeById(node.empty, id) : undefined);
  if (node.type === "conditional") return nodeById(node.then, id) ?? (node.else ? nodeById(node.else, id) : undefined);
  return undefined;
}

function buildStages(): { stages: Stage[]; preservesDiagnosis: boolean } {
  let ui = createUIPatchState(educationInitialSpecification);
  if (!ui.success) throw new Error("La UI educativa inicial es inválida");
  const initialDiagnosis = nodeById(ui.state.specification.root, "education-real-data");

  let data = createDataRegistryPatchState(educationInitialData);
  for (const patch of educationRestrictionUIPatches) {
    ui = applyUIPatch(ui.state, patch);
    if (!ui.success) throw new Error(`No se pudo aplicar UI revision ${patch.revision}`);
  }
  for (const patch of educationRestrictionDataPatches) {
    const result = applyDataRegistryPatch(data, patch);
    if (!result.success) throw new Error(`No se pudo aplicar data revision ${patch.revision}`);
    data = result.state;
  }
  const restricted: Stage = {
    label: "Restricción escrita aplicada",
    prompt: educationFlowPrompts[1],
    specification: ui.state.specification,
    data: data.data,
  };
  const preservesDiagnosis = JSON.stringify(nodeById(ui.state.specification.root, "education-real-data")) === JSON.stringify(initialDiagnosis);

  ui = applyUIPatch(ui.state, educationSliderReconciliationUIPatch);
  if (!ui.success) throw new Error("No se pudo reconciliar el slider");
  const reconciledData = applyDataRegistryPatch(data, educationSliderReconciliationPatch);
  if (!reconciledData.success) throw new Error("No se pudo reconciliar la proyección");

  return {
    preservesDiagnosis,
    stages: [
      { label: "Diagnóstico inicial", prompt: educationFlowPrompts[0], specification: educationInitialSpecification, data: educationInitialData },
      restricted,
      { label: "Simulación reconciliada", prompt: educationFlowPrompts[2], specification: ui.state.specification, data: reconciledData.state.data },
    ],
  };
}

export function FinancialEducationGallery() {
  const result = buildStages();
  const [activeStage, setActiveStage] = useState(0);
  const stage = result.stages[activeStage]!;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F6 · educación financiera · contrato v1</p>
        <h1>Diagnóstico, restricciones y simulación</h1>
        <p role="status">{result.preservesDiagnosis
          ? "Correcto: los patches conservan el diagnóstico y actualizan sólo escenario y recomendación."
          : "Falló: el diagnóstico fue reemplazado durante la actualización."}</p>
        <nav aria-label="Revisiones del flujo" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: "1rem" }}>
          {result.stages.map((item, index) => (
            <button
              aria-pressed={activeStage === index}
              key={item.label}
              type="button"
              onClick={() => setActiveStage(index)}
            >
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
            specification={stage.specification}
          />
        </article>
      </div>
    </main>
  );
}
