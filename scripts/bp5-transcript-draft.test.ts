import assert from "node:assert/strict";
import test from "node:test";
import { composeTranscriptDraft, MAX_VOICE_PROMPT_LENGTH } from "../src/features/voice/client/transcript-draft.ts";

test("parciales sustituyen al parcial anterior, no duplican palabras", () => {
  assert.equal(composeTranscriptDraft("", [], "Compara mis"), "Compara mis");
  assert.equal(composeTranscriptDraft("", [], "Compara mis gastos"), "Compara mis gastos");
});

test("segmentos confirmados conservan cantidades, meses y categorías", () => {
  assert.equal(
    composeTranscriptDraft("Por favor", ["compara 27 mil 600 pesos de agosto", "con julio en restaurantes"], "y entretenimiento"),
    "Por favor compara 27 mil 600 pesos de agosto con julio en restaurantes y entretenimiento",
  );
});

test("al parar se conserva lo confirmado y el borrador sigue siendo editable", () => {
  const draft = composeTranscriptDraft("", ["Muéstrame mis gastos de agosto"], "");
  assert.equal(draft, "Muéstrame mis gastos de agosto");
  assert.equal(`${draft} en MXN`, "Muéstrame mis gastos de agosto en MXN");
});

test("el dictado respeta el límite del prompt", () => {
  assert.equal(composeTranscriptDraft("x".repeat(MAX_VOICE_PROMPT_LENGTH), [], "extra").length, MAX_VOICE_PROMPT_LENGTH);
});
