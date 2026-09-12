import type { ValidatedAgentEvent } from "../server/stream-planned-agent";

const APPROXIMATE_CHARACTERS_PER_TOKEN = 4;

export interface GenerationMilestones {
  promptSubmittedAt: number;
  requestReceivedAt: number;
  agentStartedAt?: number;
  firstMcpRequestAt?: number;
  firstMcpResultAt?: number;
  uiGenerationStartedAt?: number;
  firstUiNodeAt?: number;
  uiCompletedAt?: number;
}

export interface RuntimeDiagnostics {
  correlationId: string;
  milestones: GenerationMilestones;
  requestBytes: number;
  modelContextBytes: number;
  streamedPayloadBytes: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  eventCount: number;
  uiPatchCount: number;
}

interface GenerationObserverOptions {
  modelContext: unknown;
  promptSubmittedAt: number;
  requestReceivedAt: number;
  requestBytes: number;
  now?: () => number;
}

function byteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

function estimatedTokens(bytes: number) {
  return Math.ceil(bytes / APPROXIMATE_CHARACTERS_PER_TOKEN);
}

export class GenerationObserver {
  readonly #now: () => number;
  readonly #requestBytes: number;
  readonly #modelContextBytes: number;
  readonly #milestones: GenerationMilestones;
  #streamedPayloadBytes = 0;
  #eventCount = 0;
  #uiPatchCount = 0;

  constructor(options: GenerationObserverOptions) {
    this.#now = options.now ?? Date.now;
    this.#requestBytes = options.requestBytes;
    this.#modelContextBytes = byteLength(options.modelContext);
    this.#milestones = {
      promptSubmittedAt: options.promptSubmittedAt,
      requestReceivedAt: options.requestReceivedAt,
    };
  }

  markAgentStarted() {
    this.#milestones.agentStartedAt ??= this.#now();
  }

  observe(event: ValidatedAgentEvent) {
    const observedAt = this.#now();
    this.#eventCount += 1;
    this.#streamedPayloadBytes += byteLength(event);

    if (event.type === "data-requested") this.#milestones.firstMcpRequestAt ??= observedAt;
    if (event.type === "data-available" || event.type === "data-patch") {
      this.#milestones.firstMcpResultAt ??= observedAt;
      this.#milestones.firstMcpRequestAt ??= observedAt;
    }
    if (event.type === "status" && event.stage === "retrieving_data") {
      this.#milestones.firstMcpRequestAt ??= observedAt;
    }
    if (event.type === "status" && event.stage === "generating_ui") {
      this.#milestones.uiGenerationStartedAt ??= observedAt;
    }
    if (event.type === "ui" || event.type === "ui-started") {
      this.#milestones.uiGenerationStartedAt ??= observedAt;
      this.#milestones.firstUiNodeAt ??= observedAt;
    }
    if (event.type === "ui-patch") this.#uiPatchCount += 1;
    if (event.type === "ui-completed") this.#milestones.uiCompletedAt ??= observedAt;
  }

  snapshot(correlationId: string): RuntimeDiagnostics {
    return {
      correlationId,
      milestones: { ...this.#milestones },
      requestBytes: this.#requestBytes,
      modelContextBytes: this.#modelContextBytes,
      streamedPayloadBytes: this.#streamedPayloadBytes,
      estimatedInputTokens: estimatedTokens(this.#modelContextBytes),
      estimatedOutputTokens: estimatedTokens(this.#streamedPayloadBytes),
      eventCount: this.#eventCount,
      uiPatchCount: this.#uiPatchCount,
    };
  }
}
