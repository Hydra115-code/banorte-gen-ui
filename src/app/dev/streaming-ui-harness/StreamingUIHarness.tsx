"use client";

import { FormEvent, useState } from "react";
import { errorPayloadSchema } from "@banorte/contracts";
import { AppShell } from "@/features/workspace/components/AppShell";
import styles from "./page.module.css";

export function StreamingUIHarness() {
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
          <strong>Harness local · Integration I6</strong>
          <span>Observa estado, datos, primera UI útil y composición final en el flujo productivo.</span>
        </aside>
        <AppShell />
      </>
    );
  }

  return (
    <main className={styles.login}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Harness local · Integration I6</p>
        <h1>Streaming UI autenticado</h1>
        <p>Esta prueba usa el PromptComposer, la ruta `/api/agent` y el renderer productivos.</p>
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
