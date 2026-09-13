import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composer = readFileSync(new URL("../src/features/workspace/components/PromptComposer.tsx", import.meta.url), "utf8");
const transcription = readFileSync(new URL("../src/features/voice/client/realtime-transcription.ts", import.meta.url), "utf8");

test("Enter o submit mientras escucha sólo terminan el dictado", () => {
  const submissionHandlers = composer.slice(composer.indexOf("const handleSubmit"), composer.indexOf("const updateTranscriptDraft"));
  const guards = submissionHandlers.match(/if \(isListening \|\| isConnecting\) \{\s*stopVoiceInput\(\);\s*return;\s*\}/gu) ?? [];
  assert.equal(guards.length, 2);
  assert.match(composer, /Terminar dictado para revisar/u);
  assert.match(composer, /type=\{isBusy \|\| isListening \|\| isConnecting \? "button" : "submit"\}/u);
});

test("parciales y confirmaciones sólo actualizan el borrador, nunca lo envían", () => {
  const callbacks = composer.slice(composer.indexOf("const connection = await startTranscription({"), composer.indexOf("connectionRef.current = connection;"));
  assert.match(callbacks, /updateTranscriptDraft\(text\)/u);
  assert.match(callbacks, /updateTranscriptDraft\(\)/u);
  assert.doesNotMatch(callbacks, /sendPrompt\(/u);
  assert.match(composer, /voiceAttemptRef\.current !== attempt/u);
});

test("el cliente usa token efímero y Scribe v2 con parciales y confirmaciones", () => {
  assert.match(transcription, /fetch\("\/api\/transcription\/realtime-session"/u);
  assert.match(transcription, /Scribe\.connect\(/u);
  assert.match(transcription, /RealtimeEvents\.PARTIAL_TRANSCRIPT/u);
  assert.match(transcription, /RealtimeEvents\.COMMITTED_TRANSCRIPT/u);
});
