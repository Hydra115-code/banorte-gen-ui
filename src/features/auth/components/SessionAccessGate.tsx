"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clearSessionArchive } from "@/features/agent/session/session-snapshot-storage";
import { resetWorkspaceStore, useWorkspaceStore } from "@/features/workspace/state/workspace-store";

type AccessState =
  | { kind: "checking" }
  | { kind: "authenticated"; ownerKey: string }
  | { kind: "sign-in" }
  | { kind: "unavailable" };

interface SessionStatus {
  authenticated: boolean;
  demoAvailable: boolean;
  ownerKey?: string;
}

function isSessionStatus(value: unknown): value is SessionStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  return typeof status.authenticated === "boolean"
    && typeof status.demoAvailable === "boolean"
    && (!status.authenticated || (typeof status.ownerKey === "string" && /^[a-f0-9]{64}$/u.test(status.ownerKey)));
}

export function SessionAccessGate({ children }: {
  children: (session: { ownerKey: string; signOut: () => Promise<void> }) => ReactNode;
}) {
  const [state, setState] = useState<AccessState>({ kind: "checking" });
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const currentOwner = useRef<string | undefined>(undefined);
  const draft = useWorkspaceStore((workspace) => workspace.draft);

  const checkSession = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible comprobar la sesión");
      const body: unknown = await response.json();
      if (!isSessionStatus(body)) throw new Error("Respuesta de sesión inválida");
      if (sequence !== requestSequence.current) return;
      setDemoAvailable(body.demoAvailable);
      if (body.authenticated && body.ownerKey) {
        if (currentOwner.current && currentOwner.current !== body.ownerKey) {
          clearSessionArchive(window.sessionStorage);
          resetWorkspaceStore();
        }
        currentOwner.current = body.ownerKey;
        setState({ kind: "authenticated", ownerKey: body.ownerKey });
        setMessage("");
      } else {
        setState({ kind: "sign-in" });
      }
    } catch {
      if (sequence === requestSequence.current) setState({ kind: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const onFocus = () => { void checkSession(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    const onAuthenticationRequired = () => {
      requestSequence.current += 1;
      setState({ kind: "sign-in" });
      setMessage("Tu sesión expiró. Inicia sesión para continuar con tu consulta.");
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("banorte:authentication-required", onAuthenticationRequired);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("banorte:authentication-required", onAuthenticationRequired);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkSession]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Revisa el correo y la contraseña e inténtalo de nuevo.");
      setPassword("");
      await checkSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      if (!response.ok) throw new Error("La sesión demo no está disponible. Puedes entrar con tu cuenta.");
      await checkSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible entrar a la demostración.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("logout_failed");
      requestSequence.current += 1;
      currentOwner.current = undefined;
      clearSessionArchive(window.sessionStorage);
      resetWorkspaceStore();
      setState({ kind: "sign-in" });
    } catch {
      setMessage("No fue posible cerrar la sesión. Comprueba la conexión e inténtalo de nuevo.");
      setState({ kind: "unavailable" });
    }
  };

  if (state.kind === "authenticated") {
    return children({ ownerKey: state.ownerKey, signOut });
  }

  return (
    <main className="access-gate" aria-busy={state.kind === "checking"}>
      <section className="access-gate__card" aria-labelledby="access-title">
        <span className="brand-logo brand-logo--gate access-gate__brand">
          <Image alt="Banorte" className="brand-logo__image" src="/banorte-logo.png" width={1920} height={236} priority />
        </span>
        <p className="canvas__eyebrow">Banca personal</p>
        <h1 id="access-title">{state.kind === "checking" ? "Comprobando tu sesión" : "Tu espacio financiero"}</h1>
        <p>Consulta tus cuentas y entiende qué cambió en tus gastos con información protegida.</p>
        {state.kind === "sign-in" ? (
          <>
            {demoAvailable ? (
              <button className="access-gate__primary" disabled={busy} onClick={() => void enterDemo()} type="button">
                Entrar a demostración
              </button>
            ) : null}
            <form className="access-gate__form" onSubmit={signIn}>
              <label>Correo electrónico<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
              <label>Contraseña<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
              <button disabled={busy} type="submit">Iniciar sesión</button>
            </form>
            {draft ? <p className="access-gate__saved">Tu consulta escrita está conservada y podrás revisarla antes de enviarla.</p> : null}
          </>
        ) : state.kind === "unavailable" ? (
          <button className="access-gate__primary" onClick={() => void checkSession()} type="button">Reintentar conexión</button>
        ) : null}
        {message ? <p className="access-gate__message" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
