import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";

const base = process.env.BP5_FRONTEND_URL ?? "http://localhost:3000";
const stress = process.argv.includes("--stress");
const phrase = process.argv.filter((value, index) => index > 1 && value !== "--stress").join(" ")
  || "Compara mis gastos de julio y agosto";

const wav = execFileSync("espeak-ng", ["-v", "es", "-s", "135", "--stdout", phrase], {
  maxBuffer: 8_000_000,
});
const converted = spawnSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-acodec", "pcm_s16le",
  "-ar", "16000", "-ac", "1", "pipe:1",
], { input: wav, maxBuffer: 8_000_000 });
assert.equal(converted.status, 0, "No se pudo preparar audio sintético local");
let pcm = converted.stdout;
if (stress) {
  const midpoint = Math.floor(pcm.length / 4) * 2;
  pcm = Buffer.concat([pcm.subarray(0, midpoint), Buffer.alloc(16_000), pcm.subarray(midpoint)]);
  for (let index = 0; index + 1 < pcm.length; index += 2) {
    const sample = pcm.readInt16LE(index);
    const noise = Math.round(120 * Math.sin(index * 0.017));
    pcm.writeInt16LE(Math.max(-32_768, Math.min(32_767, sample + noise)), index);
  }
}

const login = await fetch(`${base}/api/auth/demo`, { method: "POST" });
assert.equal(login.status, 200, "La cuenta demo local debe estar habilitada");
const cookie = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
const sessionResponse = await fetch(`${base}/api/transcription/realtime-session`, {
  method: "POST", headers: { cookie, Accept: "application/json" },
});
assert.equal(sessionResponse.status, 200, "No se emitió el token efímero");
const session = await sessionResponse.json();
assert.equal(session.config.modelId, "scribe_v2_realtime");
assert.equal(session.config.languageCode, "es");

const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
url.searchParams.set("token", session.token);
url.searchParams.set("model_id", session.config.modelId);
url.searchParams.set("audio_format", "pcm_16000");
url.searchParams.set("language_code", session.config.languageCode);
url.searchParams.set("commit_strategy", session.config.commitStrategy);
url.searchParams.set("vad_silence_threshold_secs", String(session.config.vadSilenceThresholdSecs));
url.searchParams.set("vad_threshold", String(session.config.vadThreshold));
url.searchParams.set("min_speech_duration_ms", String(session.config.minSpeechDurationMs));
url.searchParams.set("min_silence_duration_ms", String(session.config.minSilenceDurationMs));

const socket = new WebSocket(url);
let partialCount = 0;
let committed = "";
let errorCode = "";
let resolveDone;
const done = new Promise((resolve) => { resolveDone = resolve; });
socket.addEventListener("message", (event) => {
  if (typeof event.data !== "string") return;
  try {
    const message = JSON.parse(event.data);
    if (message.message_type === "partial_transcript") partialCount += 1;
    if (message.message_type === "committed_transcript" && message.text?.trim()) {
      committed += `${committed ? " " : ""}${message.text.trim()}`;
      resolveDone();
    }
    if (message.message_type?.includes("error")) {
      errorCode = message.message_type;
      resolveDone();
    }
  } catch { /* Ignore malformed transport event. */ }
});
socket.addEventListener("error", () => { errorCode = "websocket_error"; resolveDone(); });
await Promise.race([
  new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("No se abrió el WebSocket")), { once: true });
  }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de conexión")), 15_000)),
]);

for (let offset = 0; offset < pcm.length; offset += 3_200) {
  const chunk = pcm.subarray(offset, offset + 3_200);
  socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: chunk.toString("base64") }));
  await new Promise((resolve) => setTimeout(resolve, 100));
}
socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: Buffer.alloc(3_200).toString("base64"), commit: true }));
await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 10_000))]);
socket.close();
console.log(JSON.stringify({ partialCount, committed, errorCode, model: session.config.modelId, language: session.config.languageCode, stress }));
assert.equal(errorCode, "", `ElevenLabs devolvió ${errorCode}`);
assert.ok(committed.length > 0, "ElevenLabs no confirmó una transcripción");
