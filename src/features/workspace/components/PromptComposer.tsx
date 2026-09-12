"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy } from "../types/workspace-status";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";

const MAX_PROMPT_LENGTH = 2_000;

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function PromptComposer() {
  const draft = useWorkspaceStore((state) => state.draft);
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const status = useWorkspaceStore((state) => state.experience.status);
  const { cancel, generatedInterface, sendPrompt, sessionTitle } = useAgentSession();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const isBusy = isWorkspaceBusy(status);
  const canSubmit = draft.trim().length > 0 && !isBusy;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (prompt) void sendPrompt(prompt);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const prompt = draft.trim();
    if (prompt) void sendPrompt(prompt);
  };

  const handleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceMessage("La entrada por voz no está disponible en este navegador.");
      return;
    }

    const baseDraft = draft.trim();
    const recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setDraft(`${baseDraft}${baseDraft && transcript ? " " : ""}${transcript}`.slice(0, MAX_PROMPT_LENGTH));
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceMessage("No pudimos escuchar el dictado. Puedes escribir tu consulta.");
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setVoiceMessage("");
    setIsListening(true);
    recognition.start();
  };

  return (
    <footer className="composer-region">
      {generatedInterface && sessionTitle ? (
        <div className="composer-context">
          <span><i aria-hidden="true" />Continuando: <strong>{sessionTitle}</strong></span>
        </div>
      ) : null}
      <form className="composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="financial-prompt">
          Pregunta sobre tus finanzas
        </label>
        <textarea
          id="financial-prompt"
          name="prompt"
          rows={1}
          maxLength={MAX_PROMPT_LENGTH}
          placeholder="Pregunta financiera…"
          value={draft}
          disabled={isBusy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="composer__voice"
          type="button"
          aria-label={isListening ? "Detener dictado" : "Usar dictado por voz"}
          aria-pressed={isListening}
          disabled={isBusy}
          title={isListening ? "Detener dictado" : "Usar dictado por voz"}
          onClick={handleVoiceInput}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6" />
          </svg>
        </button>
        <button
          className="composer__submit"
          data-mode={isBusy ? "cancel" : "send"}
          type={isBusy ? "button" : "submit"}
          disabled={!isBusy && !canSubmit}
          aria-label={isBusy ? "Cancelar consulta" : "Enviar consulta"}
          onClick={isBusy ? cancel : undefined}
        >
          <span>{isBusy ? "Cancelar" : "Enviar"}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {isBusy ? <rect x="6.5" y="6.5" width="7" height="7" rx="1" /> : <path d="M4 10h12M11 5l5 5-5 5" />}
          </svg>
        </button>
      </form>
      <p className="composer-region__hint">
        <span aria-live="polite">{voiceMessage || (isListening ? "Escuchando…" : "Enter para enviar · Shift + Enter para una nueva línea")}</span>
        <span>Verifica la información antes de tomar una decisión financiera.</span>
      </p>
    </footer>
  );
}
