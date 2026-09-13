export interface FrontendPerformanceSummary {
  firstFeedbackPaintMs?: number;
  patchApplyP50Ms?: number;
  patchApplyP95Ms?: number;
  patchToPaintP50Ms?: number;
  patchToPaintP95Ms?: number;
  patchSamples: number;
  renderCount: number;
}

const MAX_SAMPLES = 200;

export function isUsefulGeneratedInterface(
  specification: { root: { id?: string } } | null | undefined,
) {
  return Boolean(specification?.root.id && specification.root.id !== "provisional-root");
}

function percentile(values: readonly number[], quantile: number) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return Math.round(sorted[index]! * 100) / 100;
}

export class FrontendPerformanceSampler {
  readonly #patchApply: number[] = [];
  readonly #patchToPaint: number[] = [];
  #renderCount = 0;
  #firstFeedbackPaintMs: number | undefined;

  recordFirstFeedbackPaint(durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.#firstFeedbackPaintMs ??= Math.round(durationMs * 100) / 100;
  }

  recordPatchApply(durationMs: number) {
    this.#record(this.#patchApply, durationMs);
  }

  recordPatchToPaint(durationMs: number) {
    this.#record(this.#patchToPaint, durationMs);
  }

  recordRender() {
    this.#renderCount += 1;
  }

  reset() {
    this.#patchApply.length = 0;
    this.#patchToPaint.length = 0;
    this.#renderCount = 0;
    this.#firstFeedbackPaintMs = undefined;
  }

  snapshot(): FrontendPerformanceSummary {
    return {
      firstFeedbackPaintMs: this.#firstFeedbackPaintMs,
      patchApplyP50Ms: percentile(this.#patchApply, 0.5),
      patchApplyP95Ms: percentile(this.#patchApply, 0.95),
      patchToPaintP50Ms: percentile(this.#patchToPaint, 0.5),
      patchToPaintP95Ms: percentile(this.#patchToPaint, 0.95),
      patchSamples: this.#patchToPaint.length,
      renderCount: this.#renderCount,
    };
  }

  #record(target: number[], durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    target.push(durationMs);
    if (target.length > MAX_SAMPLES) target.shift();
  }
}
