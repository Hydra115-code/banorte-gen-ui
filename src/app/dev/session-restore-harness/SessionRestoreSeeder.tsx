"use client";

import { useEffect, useState } from "react";
import { personalBankingFixture } from "@/features/generative-ui/fixtures/f0-contract-fixtures";
import { loadSessionArchive, saveSessionArchive } from "@/features/agent/session/session-snapshot-storage";

const PROBE_SESSION_ID = "44444444-4444-4444-8444-444444444444";

export function SessionRestoreSeeder() {
  const [result, setResult] = useState("Preparando prueba de restauración…");

  useEffect(() => {
    async function seed() {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const session: unknown = response.ok ? await response.json() : null;
      const ownerKey = session && typeof session === "object" && "ownerKey" in session
        && typeof session.ownerKey === "string" ? session.ownerKey : null;
      if (!ownerKey) {
        setResult("Inicia sesión para preparar la restauración.");
        return;
      }
      const now = Date.now();
      const saved = saveSessionArchive(window.sessionStorage, {
      version: "1",
      ownerKey,
      savedAt: now,
      activeAnalysisId: PROBE_SESSION_ID,
      snapshots: [{
        id: PROBE_SESSION_ID,
        title: "Prueba de restauración local",
        updatedAt: now,
        answer: "Este análisis fue reconstruido desde un snapshot validado de la pestaña.",
        specification: personalBankingFixture.specification,
        data: personalBankingFixture.data,
        interfaceRevision: 0,
        dataRevision: 0,
        invalidatedKeys: [],
        changeSummary: {
          items: ["Se actualizó el resumen de banca personal.", "Se conservaron los controles compatibles."],
          revision: 0,
          updatedAt: now,
        },
      }],
      });
      const restored = loadSessionArchive(window.sessionStorage, ownerKey, now);
      setResult(saved && restored?.activeAnalysisId === PROBE_SESSION_ID
        ? "Snapshot guardado y validado."
        : "No fue posible preparar el snapshot.");
    }
    void seed().catch(() => setResult("No fue posible comprobar la sesión."));
  }, []);

  return (
    <main>
      <p>{result}</p>
      <a href="/">Abrir el producto y restaurar</a>
    </main>
  );
}
