"use client";

import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import { personalBankingScenarios } from "@/features/generative-ui/fixtures/f5-personal-banking-fixtures";
import styles from "../contract-harness/page.module.css";

export function PersonalBankingGallery() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F5 · banca personal · contrato v1</p>
        <h1>Composiciones por intención</h1>
        <p role="status">Correcto: cuatro consultas, cuatro composiciones; validación visual sin backend.</p>
      </header>
      <div className={styles.gallery}>
        {personalBankingScenarios.map((scenario) => (
          <article className={styles.fixture} key={scenario.id}>
            <h2>{scenario.label}</h2>
            <blockquote>{scenario.prompt}</blockquote>
            <UIRenderer
              bindingOptions={{ currency: "MXN", locale: "es-MX" }}
              data={scenario.data}
              specification={scenario.specification}
            />
          </article>
        ))}
      </div>
    </main>
  );
}
