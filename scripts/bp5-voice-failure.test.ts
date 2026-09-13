import assert from "node:assert/strict";
import test from "node:test";
import { voiceFailureMessage } from "../src/features/voice/client/voice-failure-message.ts";

test("permiso denegado conserva alternativa escrita", () => {
  assert.match(voiceFailureMessage(new DOMException("denied", "NotAllowedError")), /Permiso de micrófono denegado/u);
});

test("micrófono ausente conserva alternativa escrita", () => {
  assert.match(voiceFailureMessage(new DOMException("missing", "NotFoundError")), /Puedes escribir tu consulta/u);
});

test("caída de conexión conserva alternativa escrita", () => {
  assert.match(voiceFailureMessage(new Error("network unavailable")), /Puedes escribir tu consulta/u);
});
