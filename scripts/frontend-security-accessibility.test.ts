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

const frontendRoot = new URL("../src/", import.meta.url);

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
