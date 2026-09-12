"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  errorPayloadSchema,
  financialSummaryResponseSchema,
  type FinancialSummaryResponse,
} from "@banorte/contracts";
import { DataRegistry } from "@/features/generative-ui/data-binding/registry/DataRegistry";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import { i3FinancialSummarySpecification } from "@/features/integration/fixtures/i3-financial-summary-fixture";
import styles from "./page.module.css";

const requestPeriod = { startDate: "2026-08-01", endDate: "2026-08-31", currency: "MXN" } as const;

export function DataRoundTripProbe() {
  const [email, setEmail] = useState("demo.a@example.invalid");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"idle" | "authenticating" | "loading" | "complete" | "error">("idle");
  const [result, setResult] = useState<FinancialSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registry = useMemo(
    () => result ? new DataRegistry(result.dataRegistry.data) : null,
    [result],
  );

  async function runRoundTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPhase("authenticating");

    try {
      const authResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!authResponse.ok) throw await readRequestError(authResponse);
      setPassword("");
      setPhase("loading");

      const correlationId = crypto.randomUUID();
      const dataResponse = await fetch("/api/integration/financial-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "1", correlationId, ...requestPeriod }),
      });
      const body = await dataResponse.json();
      if (!dataResponse.ok) throw requestError(body);
      const parsed = financialSummaryResponseSchema.safeParse(body);
      if (!parsed.success || parsed.data.correlationId !== correlationId) {
        throw new Error("La respuesta no cumple el contrato financiero de I3");
      }
      setResult(parsed.data);
      setPhase("complete");
    } catch (reason) {
      setPhase("error");
      setError(reason instanceof Error ? reason.message : "No fue posible completar la prueba I3");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Harness local · Integration I3</p>
        <h1>Round trip de datos sin LLM</h1>
        <p>Autentica un usuario de seed y recorre Front → Backend → MCP → Supabase → Front.</p>
      </header>

      <section className={styles.panel} aria-labelledby="i3-auth-title">
        <h2 id="i3-auth-title">Sesión de prueba</h2>
        <form className={styles.form} onSubmit={runRoundTrip}>
          <label>
            Correo
            <input
              autoComplete="username"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={phase === "authenticating" || phase === "loading"} type="submit">
            {phase === "authenticating"
              ? "Autenticando…"
              : phase === "loading"
                ? "Consultando MCP…"
                : "Ejecutar prueba I3"}
          </button>
        </form>
        <p className={styles.note}>El JWT se conserva exclusivamente en una cookie HttpOnly y nunca se muestra en esta página.</p>
      </section>

      <section className={styles.panel} aria-live="polite" aria-busy={phase === "authenticating" || phase === "loading"}>
        <h2>Resultado</h2>
        {phase === "idle" ? <p>La prueba aún no se ha ejecutado.</p> : null}
        {phase === "authenticating" ? <p>Validando la identidad con Supabase…</p> : null}
        {phase === "loading" ? <p>Consultando datos contractuales mediante el backend y MCP…</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {result && registry ? (
          <div data-i3-fixture="fixed-integration-only">
            <p className={styles.success}>Round trip completo · correlación {result.correlationId.slice(0, 8)}</p>
            <UIRenderer
              bindingOptions={{ currency: "MXN", locale: "es-MX" }}
              data={registry}
              specification={i3FinancialSummarySpecification}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

async function readRequestError(response: Response) {
  return requestError(await response.json().catch(() => null));
}

function requestError(body: unknown) {
  const parsed = errorPayloadSchema.safeParse(body);
  return new Error(parsed.success ? parsed.data.message : "La integración rechazó la solicitud");
}
