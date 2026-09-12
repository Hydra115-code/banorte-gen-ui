import { dataPatchSchema, type SessionReference } from "@banorte/contracts";

/** Validates the authoritative registry sequence without inventing missing values. */
export class DataRevisionGuard {
  private revision: number;
  private readonly keys: Set<string>;

  constructor(reference?: SessionReference) {
    this.revision = reference?.dataRevision ?? 0;
    this.keys = new Set(reference?.dataKeys ?? []);
  }

  available(key: string): void {
    this.keys.add(key);
  }

  dependenciesReady(input: unknown): boolean {
    if (!input || typeof input !== "object") return true;
    if (Array.isArray(input)) return input.every((value) => this.dependenciesReady(value));
    const record = input as Record<string, unknown>;
    if (typeof record.path === "string" && !record.path.startsWith("$")) {
      const key = record.path.split(".")[0];
      if (!key || !this.keys.has(key)) return false;
    }
    return Object.values(record).every((value) => this.dependenciesReady(value));
  }

  apply(input: unknown): boolean {
    const parsed = dataPatchSchema.safeParse(input);
    if (!parsed.success || parsed.data.baseRevision !== this.revision) return false;
    const patch = parsed.data;
    const exists = this.keys.has(patch.key);
    if ((patch.op === "add" && exists) || (patch.op !== "add" && !exists)) return false;
    if (patch.op === "remove") this.keys.delete(patch.key);
    else this.keys.add(patch.key);
    this.revision = patch.revision;
    return true;
  }

  snapshot(): { revision: number; keys: string[] } {
    return { revision: this.revision, keys: [...this.keys] };
  }
}
