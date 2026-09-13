"use client";

import { FormEvent, useState } from "react";
import { errorPayloadSchema } from "@banorte/contracts";
import { AppShell } from "@/features/workspace/components/AppShell";
import styles from "../streaming-ui-harness/page.module.css";
import { useAgentSession } from "@/features/agent/components/AgentSessionProvider";

function StaleSimulationDiagnostic() {
  const { testStaleSimulation } = useAgentSession();
  if (process.env.NODE_ENV !== "development") return null;
  return <aside><p>Después de modificar un slider de simulación y esperar su resultado:</p>
    <button type="button" onClick={testStaleSimulation}>Probar revisión obsoleta de simulación</button>
  </aside>;
}

export function UIInteractionHarness() {
  const [email, setEmail] = useState("demo.a@example.invalid");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string>();

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(undefined);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = errorPayloadSchema.safeParse(body);
      setAuthError(error.success ? error.data.message : "No fue posible iniciar sesión");
      return;
    }
    setPassword("");
    setAuthenticated(true);
  }

  if (authenticated) {
    return (
      <>
        <aside className={styles.banner}>
          <strong>Harness local · Integration I7</strong>
          <span>Modifica un control generado y observa el ciclo UIEvent → Agent → MCP → DataPatch/UIPatch.</span>
        </aside>
        <AppShell diagnostics={<StaleSimulationDiagnostic />} showDeveloperDiagnostics />
      </>
    );
  }

  return (
    <main className={styles.login}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Harness local · Integration I7</p>
        <h1>Interacción generativa autenticada</h1>
        <p>Esta prueba usa los controles, la sesión, la ruta `/api/agent` y el renderer productivos.</p>
        <form className={styles.form} onSubmit={authenticate}>
          <label>Correo<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label>Contraseña<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          <button type="submit">Iniciar prueba</button>
        </form>
        {authError ? <p className={styles.error} role="alert">{authError}</p> : null}
      </section>
    </main>
  );
}
