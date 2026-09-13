import assert from "node:assert/strict";
import test from "node:test";
import {
  isPersonalBankingAnalysisTitle,
  loadSessionArchive,
  saveSessionArchive,
  SESSION_ARCHIVE_KEY,
  SESSION_ARCHIVE_TTL_MS,
  type SessionArchive,
  type SessionStorageLike,
} from "../src/features/agent/session/session-snapshot-storage.ts";

class MemoryStorage implements SessionStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const now = 1_800_000_000_000;
const sessionId = "11111111-1111-4111-8111-111111111111";
const ownerKey = "a".repeat(64);

function archive(overrides: Partial<SessionArchive> = {}): SessionArchive {
  return {
    version: "1",
    ownerKey,
    savedAt: now,
    activeAnalysisId: sessionId,
    snapshots: [{
      id: sessionId,
      title: "Resumen mensual",
      updatedAt: now,
      answer: "Este es el resumen disponible.",
      specification: {
        version: "1",
        root: {
          type: "section",
          id: "summary-root",
          ariaLabel: "Resumen mensual",
          children: [{ type: "heading", id: "summary-title", content: "Tu resumen", level: 2 }],
        },
      },
      data: { balance: 12500 },
      interfaceRevision: 2,
      dataRevision: 3,
      invalidatedKeys: [],
    }],
    ...overrides,
  };
}

test("guarda y restaura un snapshot contractual dentro de la pestaña", () => {
  const storage = new MemoryStorage();
  assert.equal(saveSessionArchive(storage, archive()), true);
  assert.deepEqual(loadSessionArchive(storage, ownerKey, now), archive());
});

test("descarta y elimina archivos expirados", () => {
  const storage = new MemoryStorage();
  saveSessionArchive(storage, archive({ savedAt: now - SESSION_ARCHIVE_TTL_MS - 1 }));
  assert.equal(loadSessionArchive(storage, ownerKey, now), null);
  assert.equal(storage.getItem(SESSION_ARCHIVE_KEY), null);
});

test("descarta contenido alterado o que no cumple el contrato", () => {
  const storage = new MemoryStorage();
  storage.setItem(SESSION_ARCHIVE_KEY, JSON.stringify({
    ...archive(),
    snapshots: [{ ...archive().snapshots[0], interfaceRevision: -1 }],
  }));
  assert.equal(loadSessionArchive(storage, ownerKey, now), null);
  assert.equal(storage.getItem(SESSION_ARCHIVE_KEY), null);
});

test("no permite que el activo apunte fuera del archivo", () => {
  const storage = new MemoryStorage();
  const missingId = "22222222-2222-4222-8222-222222222222";
  storage.setItem(SESSION_ARCHIVE_KEY, JSON.stringify(archive({ activeAnalysisId: missingId })));
  assert.equal(loadSessionArchive(storage, ownerKey, now), null);
});

test("prioriza el análisis activo y recorta el historial al límite de bytes", () => {
  const storage = new MemoryStorage();
  const secondId = "33333333-3333-4333-8333-333333333333";
  const largeData = { chunks: Array.from({ length: 45 }, () => "x".repeat(9_000)) };
  const first = { ...archive().snapshots[0], data: largeData };
  const second = { ...first, id: secondId, title: "Segundo análisis" };
  assert.equal(saveSessionArchive(storage, archive({
    activeAnalysisId: secondId,
    snapshots: [first, second],
  })), true);

  const restored = loadSessionArchive(storage, ownerKey, now);
  assert.equal(restored?.snapshots.length, 1);
  assert.equal(restored?.snapshots[0]?.id, secondId);
  assert.equal(restored?.activeAnalysisId, secondId);
});

test("no restaura el análisis de otra identidad", () => {
  const storage = new MemoryStorage();
  assert.equal(saveSessionArchive(storage, archive()), true);
  assert.equal(loadSessionArchive(storage, "b".repeat(64), now), null);
  assert.equal(storage.getItem(SESSION_ARCHIVE_KEY), null);
});

test("BP0 identifica sesiones heredadas de verticales ocultas sin excluir análisis bancarios", () => {
  for (const title of [
    "Prepara un pago de $742 MXN",
    "Simula un préstamo a doce meses",
    "Evalúa mi salud financiera",
    "Crea una meta de ahorro",
  ]) assert.equal(isPersonalBankingAnalysisTitle(title), false, title);

  for (const title of [
    "¿Cuánto tengo disponible?",
    "Compara julio y agosto",
    "Muéstrame mis movimientos",
    "¿Por qué ahorré menos este mes?",
  ]) assert.equal(isPersonalBankingAnalysisTitle(title), true, title);
});
