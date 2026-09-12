"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useRef, useState } from "react";
import { errorPayloadSchema } from "@banorte/contracts";
import {
  agentDataPartSchemas,
  type AgentUIMessage,
} from "@/features/agent/contracts/agent-message";
import styles from "./page.module.css";

const textTransport = new DefaultChatTransport<AgentUIMessage>({
  api: "/api/integration/agent-text",
  prepareSendMessagesRequest: ({ messages, body }) => {
    const latestUserMessage = messages.findLast((message) => message.role === "user");
    return { body: { ...body, messages: latestUserMessage ? [latestUserMessage] : [] } };
  },
});

export function AgentTextProbe() {
  const [email, setEmail] = useState("demo.a@example.invalid");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [prompt, setPrompt] = useState("¿Cuánto tengo disponible?");
  const [activity, setActivity] = useState("Esperando una sesión autenticada");
  const [correlationId, setCorrelationId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [mcpResultCount, setMcpResultCount] = useState(0);
  const [suppressedUiEventCount, setSuppressedUiEventCount] = useState(0);
  const [textDeltaCount, setTextDeltaCount] = useState(0);
  const [agentError, setAgentError] = useState<string>();
  const sessionIdRef = useRef<string | undefined>(undefined);
  const correlationIdRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, status, stop, setMessages } = useChat<AgentUIMessage>({
    transport: textTransport,
    dataPartSchemas: agentDataPartSchemas,
    onData: (part) => {
      if (part.type === "data-session") {
        setSessionId(part.data.id);
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-trace") {
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-status") {
        setActivity(part.data.message);
      } else if (part.type === "data-textEvidence") {
        setMcpResultCount(part.data.mcpResultCount);
        setSuppressedUiEventCount(part.data.suppressedUiEventCount);
        setTextDeltaCount(part.data.textDeltaCount);
      } else if (part.type === "data-agentError") {
        setAgentError(part.data.message);
      }
    },
    onError: (error) => setAgentError(error.message || "No fue posible completar la consulta"),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const answer = useMemo(() => messages.findLast((message) => message.role === "assistant")?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") ?? "", [messages]);

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
    setActivity("Sesión lista para consultar al agente");
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = prompt.trim();
    if (!query || isBusy) return;
    sessionIdRef.current ??= crypto.randomUUID();
    correlationIdRef.current = crypto.randomUUID();
    setMessages([]);
    setAgentError(undefined);
    setMcpResultCount(0);
    setSuppressedUiEventCount(0);
    setTextDeltaCount(0);
    setCorrelationId(correlationIdRef.current);
    setActivity("Enviando la pregunta mediante Vercel AI SDK");
    await sendMessage({ text: query }, {
      body: {
        sessionId: sessionIdRef.current,
        correlationId: correlationIdRef.current,
      },
    });
  }

  async function cancelRequest() {
    const currentSessionId = sessionIdRef.current;
    const currentCorrelationId = correlationIdRef.current;
    setActivity("Cancelando la consulta completa");
    const cancellation = currentSessionId && currentCorrelationId
      ? fetch(`/api/integration/agent-text?sessionId=${encodeURIComponent(currentSessionId)}&correlationId=${encodeURIComponent(currentCorrelationId)}`, {
          method: "DELETE",
        })
      : Promise.resolve();
    await Promise.allSettled([stop(), cancellation]);
    setActivity("Consulta cancelada");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Harness local · Integration I4</p>
        <h1>Agente financiero en modo texto</h1>
        <p>Este checkpoint usa Vercel AI SDK, Agent API y MCP. Rechaza cualquier UI generada.</p>
      </header>

      {!authenticated ? (
        <section className={styles.panel} aria-labelledby="i4-auth-title">
          <h2 id="i4-auth-title">Autenticación</h2>
          <form className={styles.form} onSubmit={authenticate}>
            <label>Correo<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
            <label>Contraseña<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
            <button type="submit">Iniciar sesión</button>
          </form>
          {authError ? <p className={styles.error} role="alert">{authError}</p> : null}
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="i4-prompt-title">
          <h2 id="i4-prompt-title">PromptComposer temporal</h2>
          <form className={styles.promptForm} onSubmit={submitPrompt}>
            <label htmlFor="i4-prompt">Pregunta financiera</label>
            <textarea id="i4-prompt" maxLength={2_000} onChange={(event) => setPrompt(event.target.value)} rows={3} value={prompt} />
            <div className={styles.actions}>
              <button disabled={isBusy || !prompt.trim()} type="submit">Enviar al agente</button>
              <button disabled={!isBusy} onClick={() => void cancelRequest()} type="button">Cancelar</button>
            </div>
          </form>
        </section>
      )}

      <section className={styles.panel} aria-live="polite" aria-busy={isBusy}>
        <h2>Stream textual</h2>
        <dl className={styles.evidence}>
          <div><dt>Estado</dt><dd>{activity}</dd></div>
          <div><dt>Session ID</dt><dd>{sessionId?.slice(0, 8) ?? "—"}</dd></div>
          <div><dt>Correlation ID</dt><dd>{correlationId?.slice(0, 8) ?? "—"}</dd></div>
          <div><dt>Resultados MCP</dt><dd>{mcpResultCount}</dd></div>
          <div><dt>UI descartada</dt><dd>{suppressedUiEventCount}</dd></div>
          <div><dt>Fragmentos de texto</dt><dd>{textDeltaCount}</dd></div>
        </dl>
        {agentError ? <p className={styles.error} role="alert">{agentError}</p> : null}
        {answer ? <p className={styles.answer} data-i4-text-answer>{answer}</p> : <p>Aún no hay respuesta.</p>}
      </section>
    </main>
  );
}
