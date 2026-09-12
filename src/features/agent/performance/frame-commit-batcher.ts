export interface FrameBatcherStats {
  commits: number;
  enqueued: number;
}

type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

/** Keeps only the newest snapshot while preserving synchronous contractual state elsewhere. */
export class FrameCommitBatcher<T> {
  #frame: number | undefined;
  #latest: T | undefined;
  #commits = 0;
  #enqueued = 0;
  readonly commit: (value: T) => void;
  readonly requestFrame: RequestFrame;
  readonly cancelFrame: CancelFrame;

  constructor(
    commit: (value: T) => void,
    requestFrame: RequestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame: CancelFrame = (handle) => cancelAnimationFrame(handle),
  ) {
    this.commit = commit;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
  }

  enqueue(value: T) {
    this.#latest = value;
    this.#enqueued += 1;
    if (this.#frame !== undefined) return;
    this.#frame = this.requestFrame(() => this.flush());
  }

  flush() {
    if (this.#frame !== undefined) this.cancelFrame(this.#frame);
    this.#frame = undefined;
    const latest = this.#latest;
    this.#latest = undefined;
    if (latest === undefined) return false;
    this.#commits += 1;
    this.commit(latest);
    return true;
  }

  discard() {
    if (this.#frame !== undefined) this.cancelFrame(this.#frame);
    this.#frame = undefined;
    this.#latest = undefined;
  }

  get stats(): FrameBatcherStats {
    return { commits: this.#commits, enqueued: this.#enqueued };
  }
}
