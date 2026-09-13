import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentAgentFailure } from "../src/features/agent/recovery/agent-error-presentation.ts";
import { auditUISpecificationAccessibility } from "../src/features/generative-ui/accessibility/audit-ui-accessibility.ts";
import { personalBankingPatchSequence, personalBankingFixture } from "../src/features/generative-ui/fixtures/f0-contract-fixtures.ts";
import { personalBankingScenarios } from "../src/features/generative-ui/fixtures/f5-personal-banking-fixtures.ts";
import { educationInitialSpecification } from "../src/features/generative-ui/fixtures/f6-financial-education-fixtures.ts";
import { paymentCaptureSpecification, paymentRecoverableErrorSpecification, paymentReviewSpecification } from "../src/features/generative-ui/fixtures/f7-payment-preparation-fixtures.ts";
import { applyUIPatch, createUIPatchState } from "../src/features/generative-ui/patches/ui-patch-engine.ts";
import { buildContentSecurityPolicy } from "../src/shared/security/content-security-policy.ts";
import { MAX_AGENT_REQUEST_BYTES } from "../src/shared/security/request-limits.ts";
import { shouldExposeRuntimeDiagnostics } from "../src/shared/security/runtime-diagnostics-visibility.ts";
import { cleanAnswerText, summarizeAnswer } from "../src/features/workspace/presentation/summarize-answer.ts";
import { cleanGeneratedCopy } from "../src/features/generative-ui/primitives/content/clean-generated-copy.ts";
import { isGuidanceOnly } from "../src/features/workspace/presentation/is-guidance-only.ts";
import { uiSpecificationSchema } from "../src/features/generative-ui/schemas/ui-specification.ts";

const frontendRoot = new URL("../src/", import.meta.url);

test("la conclusión oculta etiquetas internas incluso cuando Gemini usa Markdown", () => {
  assert.equal(summarizeAnswer("**OBSERVED:**\nTus gastos aumentaron."), "Tus gastos aumentaron.");
  assert.equal(
    summarizeAnswer("**SIMULATED:** Podrías ahorrar más."),
    "Escenario simulado: Podrías ahorrar más.",
  );
});

test("GEN5 prioriza la conclusión financiera y conserva intactas las cifras en el detalle", () => {
  const answer = "**OBSERVED**\n* Corte de periodos: junio, julio y agosto de 2026.\n\nEl gasto total aumentó de $19,200.00 MXN en junio a $27,600.00 MXN en agosto (+43.75%). Causas:\n1. **Entretenimiento** aumentó $5,200.00 MXN.";
  assert.equal(summarizeAnswer(answer), "El gasto total aumentó de $19,200.00 MXN en junio a $27,600.00 MXN en agosto (+43.75%).");
  assert.match(cleanAnswerText(answer), /Corte de periodos: junio, julio y agosto de 2026/u);
  assert.match(cleanAnswerText(answer), /Entretenimiento aumentó \$5,200\.00 MXN/u);
  assert.doesNotMatch(cleanAnswerText(answer), /OBSERVED|\*\*/u);
});

test("GEN5 resume causas sin jerga y limpia etiquetas internas del lienzo", () => {
  const answer = "Comparando meses completos (junio de 30 días, corte al 30/06; julio de 31 días, corte al 31/07; agosto de 31 días, corte al 31/08), el incremento de gastos proviene de: - Entretenimiento: subió de 800 MXN a 1,200 MXN y 6,400 MXN. - Restaurantes: aumentó de 2,450 MXN a 5,250 MXN.";
  assert.equal(summarizeAnswer(answer), "El incremento de gastos proviene de Entretenimiento y Restaurantes.");
  assert.equal(cleanGeneratedCopy("OBSERVED: El incremento fue de 5,200 MXN."), "El incremento fue de 5,200 MXN.");
  assert.equal(cleanGeneratedCopy("**SIMULATED:** Podrías ahorrar 200 MXN."), "Escenario simulado: Podrías ahorrar 200 MXN.");
});

test("GEN5 muestra una respuesta textual en el chat sin dejar un lienzo vacío", () => {
  const guidance = uiSpecificationSchema.parse({
    version: "1",
    root: {
      type: "section", ariaLabel: "Orientación", children: [
        { type: "alert", message: "Haz una pregunta sobre tus cuentas." },
      ],
    },
  });
  assert.equal(isGuidanceOnly(guidance, false), true);
  assert.equal(isGuidanceOnly(guidance, true), false);
  assert.equal(isGuidanceOnly(personalBankingFixture.specification, false), false);
});

test("los diagnósticos internos sólo se exponen en desarrollo", () => {
  assert.equal(shouldExposeRuntimeDiagnostics("development"), false);
  assert.equal(shouldExposeRuntimeDiagnostics("development", true), true);
  assert.equal(shouldExposeRuntimeDiagnostics("production"), false);
  assert.equal(shouldExposeRuntimeDiagnostics("production", true), false);
  assert.equal(shouldExposeRuntimeDiagnostics("test"), false);
  assert.equal(shouldExposeRuntimeDiagnostics(undefined), false);
});

test("la CSP de producción bloquea código y superficies externas", () => {
  const policy = buildContentSecurityPolicy("nonce-de-prueba", false);
  for (const directive of [
    "default-src 'self'", "script-src-attr 'none'", "object-src 'none'", "frame-src 'none'",
    "base-uri 'none'", "frame-ancestors 'none'", "connect-src 'self'", "upgrade-insecure-requests",
  ]) assert.match(policy, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/u);
});

test("el proxy frontend respeta el límite de 16 KiB del backend actual", () => {
  assert.equal(MAX_AGENT_REQUEST_BYTES, 16_384);
  const route = readFileSync(new URL("../src/app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(route, /MAX_AGENT_REQUEST_BYTES/u);
  assert.match(route, /TextEncoder\(\)\.encode\(body\)\.byteLength/u);
});

test("las tres verticales no presentan faltantes de accesibilidad contractual", () => {
  const specifications = [
    ...personalBankingScenarios.map((scenario) => scenario.specification),
    educationInitialSpecification,
    paymentCaptureSpecification,
    paymentReviewSpecification,
    paymentRecoverableErrorSpecification,
  ];
  for (const specification of specifications) {
    const state = createUIPatchState(specification);
    assert.equal(state.success, true);
    if (state.success) assert.deepEqual(auditUISpecificationAccessibility(state.state.specification), []);
  }
});

test("los cinco tipos de UI Patch se aplican sin perder validación", () => {
  let state = createUIPatchState(personalBankingFixture.specification);
  assert.equal(state.success, true);
  if (!state.success) return;
  for (const patch of personalBankingPatchSequence) {
    state = applyUIPatch(state.state, patch);
    assert.equal(state.success, true, patch.op);
    if (!state.success) return;
  }
  assert.equal(state.state.revision, 5);
  assert.equal(state.state.nodeIndex.has("fresh-data-alert"), false);
});

test("sesión expirada, saldo insuficiente y duplicados no ofrecen reintento peligroso", () => {
  for (const [code, title] of [
    ["session_expired", "Tu sesión expiró"],
    ["payment_insufficient_funds", "Saldo insuficiente"],
    ["duplicate_payment", "La operación ya fue recibida"],
  ] as const) {
    const presentation = presentAgentFailure({ code, recoverable: true, hasPartialData: true });
    assert.equal(presentation.title, title);
    assert.equal(presentation.canRetry, false);
    assert.equal(presentation.canContinue, true);
  }
});

test("el runtime no usa HTML ejecutable ni persiste datos en localStorage", () => {
  const files = [
    "features/generative-ui/renderer/UIRenderer.tsx",
    "features/generative-ui/runtime/LayoutRenderer.tsx",
    "features/agent/session/session-snapshot-storage.ts",
  ];
  const source = files.map((path) => readFileSync(new URL(path, frontendRoot), "utf8")).join("\n");
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|\beval\s*\(|new Function|localStorage/u);
  const canvas = readFileSync(new URL("features/workspace/components/GenerativeCanvas.tsx", frontendRoot), "utf8");
  const shell = readFileSync(new URL("features/workspace/components/AppShell.tsx", frontendRoot), "utf8");
  assert.match(shell, /shouldExposeRuntimeDiagnostics\(process\.env\.NODE_ENV, showDeveloperDiagnostics\)/u);
  assert.match(canvas, /showRuntimeDiagnostics/u);
  assert.match(canvas, /tabIndex=\{-1\}/u);
});

test("BP6 no permite que la ruta de voz sustituya la sesión por un token estático", () => {
  const route = readFileSync(new URL("../src/app/api/transcription/realtime-session/route.ts", import.meta.url), "utf8");
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.match(route, /refreshSupabaseSession\(cookies\.refreshToken\)/u);
  assert.doesNotMatch(route, /AGENT_API_TOKEN|SUPABASE_ACCESS_TOKEN/u);
});
