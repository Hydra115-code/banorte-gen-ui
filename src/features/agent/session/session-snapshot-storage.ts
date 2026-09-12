import { z } from "zod";
import { dataRegistrySchema, uiSpecificationSchema } from "@banorte/contracts";

export const SESSION_ARCHIVE_KEY = "banorte:agent-session:v1";
export const SESSION_ARCHIVE_TTL_MS = 30 * 60 * 1_000;
export const MAX_SESSION_ARCHIVE_BYTES = 750_000;
const MAX_PERSISTED_ANALYSES = 8;

export interface SessionStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const persistedSnapshotSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(72),
  updatedAt: z.number().int().nonnegative().max(9_000_000_000_000_000),
  answer: z.string().max(20_000),
  specification: uiSpecificationSchema,
  data: dataRegistrySchema,
  interfaceRevision: z.number().int().nonnegative().max(1_000_000),
  dataRevision: z.number().int().nonnegative().max(1_000_000),
  invalidatedKeys: z.array(z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).max(100),
  degradationReason: z.enum(["generation_interrupted", "partial_data"]).optional(),
  changeSummary: z.object({
    items: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
    revision: z.number().int().nonnegative().max(1_000_000),
    updatedAt: z.number().int().nonnegative().max(9_000_000_000_000_000),
  }).strict().optional(),
}).strict();

const sessionArchiveSchema = z.object({
  version: z.literal("1"),
  savedAt: z.number().int().nonnegative().max(9_000_000_000_000_000),
  activeAnalysisId: z.string().uuid().optional(),
  snapshots: z.array(persistedSnapshotSchema).min(1).max(MAX_PERSISTED_ANALYSES),
}).strict();

export type PersistedAnalysisSnapshot = z.infer<typeof persistedSnapshotSchema>;
export type SessionArchive = z.infer<typeof sessionArchiveSchema>;

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function removeQuietly(storage: SessionStorageLike) {
  try {
    storage.removeItem(SESSION_ARCHIVE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
  }
}

export function loadSessionArchive(
  storage: SessionStorageLike,
  now = Date.now(),
): SessionArchive | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(SESSION_ARCHIVE_KEY);
  } catch {
    return null;
  }
  if (!serialized) return null;
  if (byteLength(serialized) > MAX_SESSION_ARCHIVE_BYTES) {
    removeQuietly(storage);
    return null;
  }

  try {
    const parsed = sessionArchiveSchema.safeParse(JSON.parse(serialized) as unknown);
    if (!parsed.success || now - parsed.data.savedAt > SESSION_ARCHIVE_TTL_MS || parsed.data.savedAt > now + 60_000) {
      removeQuietly(storage);
      return null;
    }
    if (parsed.data.activeAnalysisId && !parsed.data.snapshots.some((item) => item.id === parsed.data.activeAnalysisId)) {
      removeQuietly(storage);
      return null;
    }
    return parsed.data;
  } catch {
    removeQuietly(storage);
    return null;
  }
}

export function saveSessionArchive(
  storage: SessionStorageLike,
  input: SessionArchive,
): boolean {
  const parsed = sessionArchiveSchema.safeParse(input);
  if (!parsed.success) return false;

  const active = parsed.data.activeAnalysisId
    ? parsed.data.snapshots.find((snapshot) => snapshot.id === parsed.data.activeAnalysisId)
    : undefined;
  const ordered = [
    ...(active ? [active] : []),
    ...parsed.data.snapshots.filter((snapshot) => snapshot.id !== active?.id),
  ];

  for (let count = ordered.length; count > 0; count -= 1) {
    const candidate: SessionArchive = {
      ...parsed.data,
      snapshots: ordered.slice(0, count),
      ...(active ? { activeAnalysisId: active.id } : { activeAnalysisId: undefined }),
    };
    const serialized = JSON.stringify(candidate);
    if (byteLength(serialized) > MAX_SESSION_ARCHIVE_BYTES) continue;
    try {
      storage.setItem(SESSION_ARCHIVE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function clearSessionArchive(storage: SessionStorageLike): void {
  removeQuietly(storage);
}
