"use client";

import { useState } from "react";
import type { DataRegistryValue, UISpecification } from "@banorte/contracts";
import { auditUISpecificationAccessibility } from "@/features/generative-ui/accessibility/audit-ui-accessibility";
import { monthlySpendingScenario } from "@/features/generative-ui/fixtures/f5-personal-banking-fixtures";
import { educationInitialData, educationInitialSpecification } from "@/features/generative-ui/fixtures/f6-financial-education-fixtures";
import { paymentRecoverableErrorSpecification, paymentReviewData } from "@/features/generative-ui/fixtures/f7-payment-preparation-fixtures";
import { createUIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import styles from "../contract-harness/page.module.css";

interface ValidStage {
  label: string;
  specification: UISpecification;
  data: DataRegistryValue;
}

const validStages: ValidStage[] = [
  { label: "Banca personal", specification: monthlySpendingScenario.specification, data: monthlySpendingScenario.data },
  { label: "Educación financiera", specification: educationInitialSpecification, data: educationInitialData },
  { label: "Pago con error recuperable", specification: paymentRecoverableErrorSpecification, data: paymentReviewData },
];

const invalidSpecification = {
  version: "1",
  root: { type: "html", id: "unsafe-node", content: "<script>no permitido</script>" },
};

export function QualityGateGallery() {
  const [activeStage, setActiveStage] = useState(0);
  const invalid = activeStage === validStages.length;
  const stage = validStages[activeStage];
  const validated = stage ? createUIPatchState(stage.specification) : undefined;
  const issues = validated?.success ? auditUISpecificationAccessibility(validated.state.specification) : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F9 · seguridad y accesibilidad · contrato v1</p>
        <h1>Gate visual de las tres verticales</h1>
        <p aria-live="polite" role="status">
          {invalid
            ? "Correcto: el contenido ejecutable se rechazó y degradó de forma segura."
            : `Correcto: ${stage?.label} tiene ${issues.length} incidencias contractuales de accesibilidad.`}
        </p>
        <nav aria-label="Escenarios de calidad" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: "1rem" }}>
          {[...validStages.map((item) => item.label), "Payload inválido"].map((label, index) => (
            <button aria-pressed={activeStage === index} key={label} type="button" onClick={() => setActiveStage(index)}>
              {index + 1}. {label}
            </button>
          ))}
        </nav>
      </header>
      <div className={styles.gallery}>
        <article className={styles.fixture} key={invalid ? "invalid" : stage?.label}>
          <h2>{invalid ? "Degradación segura" : stage?.label}</h2>
          <UIRenderer
            data={invalid ? undefined : stage?.data}
            specification={invalid ? invalidSpecification : stage?.specification}
          />
        </article>
      </div>
    </main>
  );
}
