"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { RealtimeConnection } from "@elevenlabs/client";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy } from "../types/workspace-status";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { startTranscription } from "../../voice/client/realtime-transcription";
import { composeTranscriptDraft } from "../../voice/client/transcript-draft";
import { voiceFailureMessage } from "../../voice/client/voice-failure-message";

const MAX_PROMPT_LENGTH = 2_000;
type VoicePhase = "idle" | "connecting" | "listening" | "ready" | "error";

export function PromptComposer() {
  const draft = useWorkspaceStore((state) => state.draft);
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const status = useWorkspaceStore((state) => state.experience.status);
  const { cancel, generatedInterface, sendPrompt } = useAgentSession();

  const connectionRef = useRef<RealtimeConnection | null>(null);
  const baseDraftRef = useRef("");
  const committedSegmentsRef = useRef<string[]>([]);
  const voiceAttemptRef = useRef(0);

  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");

  const isBusy = isWorkspaceBusy(status);
  const isConnecting = voicePhase === "connecting";
  const isListening = voicePhase === "listening";
  const canSubmit = draft.trim().length > 0 && !isBusy;

  const stopVoiceInput = (nextPhase?: VoicePhase) => {
    voiceAttemptRef.current += 1;
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    setVoicePhase(nextPhase ?? (useWorkspaceStore.getState().draft.trim() !== baseDraftRef.current ? "ready" : "idle"));
  };

  useEffect(() => {
    return () => {
      voiceAttemptRef.current += 1;
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isListening || isConnecting) {
      stopVoiceInput();
      return;
    }
    const prompt = draft.trim();
    if (prompt) {
      setVoicePhase("idle");
      setVoiceMessage("");
      void sendPrompt(prompt);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (isListening || isConnecting) {
      stopVoiceInput();
      return;
    }
    const prompt = draft.trim();
    if (prompt) {
      setVoicePhase("idle");
      setVoiceMessage("");
      void sendPrompt(prompt);
    }
  };

  const updateTranscriptDraft = (partialText?: string) => {
    setDraft(composeTranscriptDraft(baseDraftRef.current, committedSegmentsRef.current, partialText));
  };

  const handleVoiceInput = async () => {
    if (isListening || isConnecting) {
      stopVoiceInput();
      return;
    }

    baseDraftRef.current = draft.trim();
    committedSegmentsRef.current = [];
    setVoiceMessage("");
    setVoicePhase("connecting");
    const attempt = ++voiceAttemptRef.current;

    try {
      const connection = await startTranscription({
        onOpen: () => {
          if (voiceAttemptRef.current === attempt) setVoicePhase("listening");
        },
        onPartial: (text) => {
          if (voiceAttemptRef.current !== attempt) return;
          setVoicePhase("listening");
          updateTranscriptDraft(text);
        },
        onCommitted: (text) => {
          if (voiceAttemptRef.current !== attempt) return;
          setVoicePhase("listening");
          if (text && text.trim()) {
            committedSegmentsRef.current.push(text.trim());
          }
          updateTranscriptDraft();
        },
        onError: (error) => {
          if (voiceAttemptRef.current !== attempt) return;
          stopVoiceInput("error");
          setVoiceMessage(voiceFailureMessage(error));
        },
        onClose: () => {
          if (voiceAttemptRef.current === attempt) stopVoiceInput();
        },
      });

      if (voiceAttemptRef.current !== attempt) {
        connection.close();
        return;
      }
      connectionRef.current = connection;
    } catch (error) {
      if (voiceAttemptRef.current !== attempt) return;
      stopVoiceInput("error");
      setVoiceMessage(voiceFailureMessage(error));
    }
  };

  return (
    <footer className="composer-region">
      {generatedInterface ? (
        <div className="composer-context">
          <span><i aria-hidden="true" />Resultado listo · Puedes pedir más detalle</span>
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
          placeholder="Pregunta sobre tus cuentas…"
          value={draft}
          disabled={isBusy}
          onChange={(event) => {
            if (isListening || isConnecting) stopVoiceInput();
            if (voicePhase === "error") {
              setVoicePhase("idle");
              setVoiceMessage("");
            }
            setDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className="composer__voice"
          type="button"
          aria-label={isListening ? "Detener dictado" : isConnecting ? "Conectando micrófono…" : "Usar dictado por voz"}
          aria-pressed={isListening}
          disabled={isBusy}
          title={isListening ? "Detener dictado" : isConnecting ? "Conectando micrófono…" : "Usar dictado por voz"}
          onClick={handleVoiceInput}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6" />
          </svg>
        </button>
        <button
          className="composer__submit"
          data-mode={isBusy ? "cancel" : isListening || isConnecting ? "review" : "send"}
          type={isBusy || isListening || isConnecting ? "button" : "submit"}
          disabled={!isBusy && !canSubmit && !isListening && !isConnecting}
          aria-label={isBusy ? "Cancelar consulta" : isListening || isConnecting ? "Terminar dictado para revisar" : "Enviar consulta"}
          onClick={isBusy ? cancel : isListening || isConnecting ? () => stopVoiceInput() : undefined}
        >
          <span>{isBusy ? "Cancelar" : isListening || isConnecting ? "Revisar" : "Enviar"}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {isBusy || isListening || isConnecting ? <rect x="6.5" y="6.5" width="7" height="7" rx="1" /> : <path d="M4 10h12M11 5l5 5-5 5" />}
          </svg>
        </button>
      </form>
      <p className="composer-region__hint" data-voice-phase={voicePhase}>
        <span aria-live="polite">
          {voiceMessage || (isConnecting ? "Conectando micrófono…" : isListening ? "Escuchando…" : voicePhase === "ready" ? "Dictado listo: revisa importes y fechas antes de enviar" : "Enter para enviar · Shift + Enter para una nueva línea")}
        </span>
        <span>Verifica la información antes de tomar una decisión financiera.</span>
      </p>
    </footer>
  );
}
