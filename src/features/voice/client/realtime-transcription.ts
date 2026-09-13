import {
  CommitStrategy,
  type RealtimeConnection,
  RealtimeEvents,
  Scribe,
} from "@elevenlabs/client";
import { z } from "zod";

export type SessionResponse = {
  version: string;
  token: string;
  expiresInSeconds: number;
  config: {
    modelId: string;
    languageCode: string;
    commitStrategy: "vad" | "manual";
    vadSilenceThresholdSecs: number;
    vadThreshold: number;
    minSpeechDurationMs: number;
    minSilenceDurationMs: number;
    includeTimestamps: boolean;
    microphone: {
      echoCancellation: boolean;
      noiseSuppression: boolean;
      autoGainControl: boolean;
    };
    manualAudio?: {
      audioFormat: string;
      sampleRate: number;
    };
  };
};

export interface StartTranscriptionOptions {
  onOpen?: () => void;
  onPartial: (text: string) => void;
  onCommitted: (text: string) => void;
  onError: (error: unknown) => void;
  onClose?: () => void;
}

export async function startTranscription(
  options: StartTranscriptionOptions,
): Promise<RealtimeConnection> {
  const response = await fetch("/api/transcription/realtime-session", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = "No fue posible iniciar la transcripción";
    try {
      const errorJson = (await response.json()) as { message?: string };
      if (errorJson.message) errorMessage = errorJson.message;
    } catch {
      // Ignorar fallback de parsing
    }
    throw new Error(errorMessage);
  }

  const session = sessionResponseSchema.parse(await response.json()) as SessionResponse;

  const connection = Scribe.connect({
    token: session.token,
    modelId: session.config.modelId,
    languageCode: session.config.languageCode,
    commitStrategy:
      session.config.commitStrategy === "vad"
        ? CommitStrategy.VAD
        : CommitStrategy.MANUAL,
    vadSilenceThresholdSecs: session.config.vadSilenceThresholdSecs,
    vadThreshold: session.config.vadThreshold,
    minSpeechDurationMs: session.config.minSpeechDurationMs,
    minSilenceDurationMs: session.config.minSilenceDurationMs,
    includeTimestamps: session.config.includeTimestamps,
    microphone: {
      ...session.config.microphone,
      workletPaths: {
        scribeAudioProcessor: "/worklets/scribeAudioProcessor.js",
      },
    },
  });

  connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (event) => {
    if (event && typeof event.text === "string") {
      options.onPartial(event.text);
    }
  });

  connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (event) => {
    if (event && typeof event.text === "string") {
      options.onCommitted(event.text);
    }
  });

  connection.on(RealtimeEvents.ERROR, options.onError);
  for (const event of [
    RealtimeEvents.AUTH_ERROR,
    RealtimeEvents.QUOTA_EXCEEDED,
    RealtimeEvents.RATE_LIMITED,
    RealtimeEvents.TRANSCRIBER_ERROR,
    RealtimeEvents.INPUT_ERROR,
    RealtimeEvents.RESOURCE_EXHAUSTED,
  ] as const) connection.on(event, options.onError);
  if (options.onOpen) connection.on(RealtimeEvents.OPEN, options.onOpen);

  if (options.onClose) {
    connection.on(RealtimeEvents.CLOSE, options.onClose);
  }

  return connection;
}

const sessionResponseSchema = z.object({
  version: z.literal("1"),
  token: z.string().min(16).max(4_096),
  expiresInSeconds: z.number().int().positive(),
  config: z.object({
    modelId: z.literal("scribe_v2_realtime"),
    languageCode: z.literal("es"),
    commitStrategy: z.enum(["vad", "manual"]),
    vadSilenceThresholdSecs: z.number(),
    vadThreshold: z.number(),
    minSpeechDurationMs: z.number(),
    minSilenceDurationMs: z.number(),
    includeTimestamps: z.boolean(),
    microphone: z.object({
      echoCancellation: z.boolean(),
      noiseSuppression: z.boolean(),
      autoGainControl: z.boolean(),
    }),
  }),
});
