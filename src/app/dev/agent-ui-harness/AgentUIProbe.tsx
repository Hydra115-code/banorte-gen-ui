"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useRef, useState } from "react";
import { errorPayloadSchema, type UISpecification } from "@banorte/contracts";
import {
  agentDataPartSchemas,
  type AgentCompleteUIEvidence,
  type AgentUIMessage,
} from "@/features/agent/contracts/agent-message";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import type { DataRegistryValue } from "@/features/generative-ui/data-binding/schemas/data-registry-schema";
import styles from "./page.module.css";

const prompts = [
  "¿Cuánto tengo disponible?",
  "¿En qué se me está yendo el dinero?",
  "Explícame por qué no logro ahorrar.",
] as const;

const transport = new DefaultChatTransport<AgentUIMessage>({
  api: "/api/integration/agent-ui",
  prepareSendMessagesRequest: ({ messages, body }) => {
    const latest = messages.findLast((message) => message.role === "user");
    return { body: { ...body, messages: latest ? [latest] : [] } };
  },
});

interface CompletedScenario extends AgentCompleteUIEvidence {
  prompt: string;
}

export function AgentUIProbe() {
  const [email, setEmail] = useState("demo.a@example.invalid");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [prompt, setPrompt] = useState<string>(prompts[0]);
  const [activity, setActivity] = useState("Esperando una sesión autenticada");
  const [specification, setSpecification] = useState<UISpecification>();
  const [data, setData] = useState<DataRegistryValue>();
  const [evidence, setEvidence] = useState<AgentCompleteUIEvidence>();
  const [completed, setCompleted] = useState<CompletedScenario[]>([]);
  const [agentError, setAgentError] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [correlationId, setCorrelationId] = useState<string>();
  const activePromptRef = useRef("");

  const { messages, sendMessage, status, setMessages } = useChat<AgentUIMessage>({
    transport,
    dataPartSchemas: agentDataPartSchemas,
    onData: (part) => {
      if (part.type === "data-session") {
        setSessionId(part.data.id);
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-trace") {
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-status") {
        setActivity(part.data.message);
      } else if (part.type === "data-ui") {
        setSpecification(part.data.specification);
        setData(part.data.data);
      } else if (part.type === "data-completeUIEvidence") {
        setEvidence(part.data);
        setCompleted((current) => [
          ...current.filter((item) => item.prompt !== activePromptRef.current),
          { ...part.data, prompt: activePromptRef.current },
        ]);
      } else if (part.type === "data-agentError") {
        setAgentError(part.data.message);
      }
    },
    onError: (error) => setAgentError(error.message || "No fue posible generar la interfaz"),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const answer = useMemo(() => messages.findLast((message) => message.role === "assistant")?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") ?? "", [messages]);
  const distinctCompositionCount = new Set(completed.map((item) => item.compositionSignature)).size;

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
    setActivity("Sesión lista para generar una interfaz");
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = prompt.trim();
    if (!query || isBusy) return;
    const nextSessionId = crypto.randomUUID();
    const nextCorrelationId = crypto.randomUUID();
    activePromptRef.current = query;
    setMessages([]);
    setSpecification(undefined);
    setData(undefined);
    setEvidence(undefined);
    setAgentError(undefined);
    setSessionId(nextSessionId);
    setCorrelationId(nextCorrelationId);
    setActivity("Esperando la UISpecification completa");
    await sendMessage({ text: query }, {
      body: { sessionId: nextSessionId, correlationId: nextCorrelationId },
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Harness local · Integration I5</p>
        <h1>Primera Generative UI end-to-end</h1>
        <p>La interfaz completa proviene del Agent, MCP y UI Planner. No contiene composiciones financieras preconstruidas.</p>
      </header>

      {!authenticated ? (
        <section className={styles.panel}>
          <h2>Autenticación</h2>
          <form className={styles.form} onSubmit={authenticate}>
            <label>Correo<input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
            <label>Contraseña<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
            <button type="submit">Iniciar sesión</button>
          </form>
          {authError ? <p className={styles.error} role="alert">{authError}</p> : null}
        </section>
      ) : (
        <section className={styles.panel}>
          <h2>PromptComposer temporal</h2>
          <div className={styles.presets} aria-label="Escenarios de prueba">
            {prompts.map((item) => <button key={item} disabled={isBusy} onClick={() => setPrompt(item)} type="button">{item}</button>)}
          </div>
          <form className={styles.promptForm} onSubmit={submitPrompt}>
            <label htmlFor="i5-prompt">Pregunta financiera</label>
            <textarea id="i5-prompt" maxLength={2_000} onChange={(event) => setPrompt(event.target.value)} rows={3} value={prompt} />
            <button disabled={isBusy || !prompt.trim()} type="submit">Generar interfaz completa</button>
          </form>
        </section>
      )}

      <section className={styles.panel} aria-busy={isBusy} aria-live="polite">
        <h2>Evidencia del recorrido</h2>
        <dl className={styles.evidence}>
          <div><dt>Estado</dt><dd>{activity}</dd></div>
          <div><dt>Session</dt><dd>{sessionId?.slice(0, 8) ?? "—"}</dd></div>
          <div><dt>Correlation</dt><dd>{correlationId?.slice(0, 8) ?? "—"}</dd></div>
          <div><dt>Patches de datos</dt><dd>{evidence?.dataPatchCount ?? 0}</dd></div>
          <div><dt>Validación</dt><dd>{evidence?.validationResult ?? "—"}</dd></div>
          <div><dt>Render</dt><dd>{specification ? "montado" : "—"}</dd></div>
          <div><dt>Raíz</dt><dd>{evidence?.rootType ?? "—"}</dd></div>
          <div><dt>Nodos</dt><dd>{evidence?.nodeCount ?? 0}</dd></div>
          <div><dt>Composiciones distintas</dt><dd>{distinctCompositionCount}/{completed.length}</dd></div>
        </dl>
        {agentError ? <p className={styles.error} role="alert">{agentError}</p> : null}
        {answer ? <p className={styles.answer}>{answer}</p> : null}
        {evidence && specification ? (
          <details className={styles.debug}>
            <summary>Payload validado para debugging</summary>
            <pre>{JSON.stringify({
              prompt: activePromptRef.current,
              sessionId,
              correlationId,
              dataKeys: evidence.dataKeys,
              compositionSignature: evidence.compositionSignature,
              validationResult: evidence.validationResult,
              renderResult: "mounted",
              specification,
            }, null, 2)}</pre>
          </details>
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.generated}`} data-i5-generated-ui>
        <h2>Interfaz generada</h2>
        {specification ? <UIRenderer data={data} specification={specification} /> : <p>Aún no hay una UISpecification completa.</p>}
      </section>

      {completed.length ? (
        <section className={styles.panel}>
          <h2>Escenarios completados</h2>
          <ul className={styles.scenarios}>
            {completed.map((item) => (
              <li key={item.prompt}>
                <strong>{item.prompt}</strong>
                <span>{item.rootType} · {item.nodeCount} nodos · {item.dataPatchCount} patches de datos</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
