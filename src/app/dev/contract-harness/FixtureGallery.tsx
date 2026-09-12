"use client";

import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import {
  f0ContractFixtures,
  personalBankingFixture,
  personalBankingPatchSequence,
} from "@/features/generative-ui/fixtures/f0-contract-fixtures";
import { applyUIPatch, createUIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import styles from "./page.module.css";

function patchedPersonalBankingSpecification() {
  let result = createUIPatchState(personalBankingFixture.specification);
  if (!result.success) throw new Error("El fixture inicial de banca personal es inválido");

  for (const patch of personalBankingPatchSequence) {
    result = applyUIPatch(result.state, patch);
    if (!result.success) throw new Error(`El fixture no pudo aplicar el patch ${patch.revision}`);
  }

  return result.state.specification;
}

export function FixtureGallery() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Harness local · contrato v1</p>
        <h1>Fixtures del runtime generativo</h1>
        <p>Validación visual sin backend. Ninguna acción de pago se ejecuta desde esta pantalla.</p>
      </header>

      <div className={styles.gallery}>
        {f0ContractFixtures.map((fixture) => (
          <article className={styles.fixture} key={fixture.id}>
            <h2>{fixture.label}</h2>
            <UIRenderer
              bindingOptions={{ currency: "MXN", locale: "es-MX" }}
              data={fixture.data}
              specification={fixture.specification}
            />
          </article>
        ))}

        <article className={styles.fixture}>
          <h2>Banca personal después de 5 patches</h2>
          <UIRenderer
            bindingOptions={{ currency: "MXN", locale: "es-MX" }}
            data={personalBankingFixture.data}
            specification={patchedPersonalBankingSpecification()}
          />
        </article>
      </div>
    </main>
  );
}
