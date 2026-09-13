import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  financialSummaryResponseSchema,
  uiSpecificationSchema,
} from "@banorte/contracts";
import { requestSupabaseSession } from "../src/features/auth/server/supabase-session-request.ts";
import { fetchFinancialSummary } from "../src/features/integration/server/financial-summary-wire.ts";
import { i3FinancialSummarySpecification } from "../src/features/integration/fixtures/i3-financial-summary-fixture.ts";
import { accessTokenNeedsRefresh } from "../src/features/auth/server/access-token-expiry.ts";

process.env.SUPABASE_URL = "https://project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key-with-sufficient-test-length";
process.env.AGENT_API_URL = "http://127.0.0.1:3101/api/agent";

const correlationId = "30000000-0000-4000-8000-000000000003";
const request = {
  version: "1",
  correlationId,
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  currency: "MXN",
} as const;
const response = financialSummaryResponseSchema.parse({
  version: "1",
  correlationId,
  dataRegistry: {
    version: "1",
    revision: 0,
    data: {
      financialSummary: {
        summaries: [{
          currency: "MXN",
          totalIncome: "25000.00",
          totalExpenses: "18100.00",
          netCashFlow: "6900.00",
          savingsRate: "27.60",
          transactionCount: 25,
          largestExpense: "8500.00",
          largestIncome: "25000.00",
        }],
        metadata: { source: "supabase" },
      },
    },
  },
});

test("autentica contra Supabase sin devolver credenciales ni tokens al cliente", async () => {
  const session = await requestSupabaseSession(
    { url: new URL("https://project.supabase.co"), publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY! },
    "password",
    { email: "demo.a@example.invalid", password: "local-password" },
    async (input, init) => {
      assert.match(String(input), /\/auth\/v1\/token\?grant_type=password$/u);
      assert.equal(new Headers(init?.headers).get("apikey"), process.env.SUPABASE_PUBLISHABLE_KEY);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        email: "demo.a@example.invalid",
        password: "local-password",
      });
      return Response.json({
        access_token: "access-token-with-sufficient-length-for-test",
        refresh_token: "refresh-token-with-sufficient-length-for-test",
        expires_in: 3600,
        user: { id: "10000000-0000-4000-8000-000000000001" },
      });
    },
  );
  assert.equal(session.userId, "10000000-0000-4000-8000-000000000001");
  assert.equal("email" in session, false);
  assert.equal("password" in session, false);
});

test("envía el JWT individual al backend y valida el round trip contractual", async () => {
  const result = await fetchFinancialSummary(
    new URL("http://127.0.0.1:3101/api/integration/financial-summary"),
    request,
    "individual-user-jwt-with-sufficient-length",
    async (input, init) => {
      assert.equal(String(input), "http://127.0.0.1:3101/api/integration/financial-summary");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer individual-user-jwt-with-sufficient-length");
      assert.equal(headers.get("X-Correlation-ID"), correlationId);
      assert.deepEqual(JSON.parse(String(init?.body)), request);
      return Response.json(response);
    },
  );
  assert.deepEqual(result, response);
});

test("rechaza una respuesta con correlación diferente", async () => {
  await assert.rejects(
    fetchFinancialSummary(
      new URL("http://127.0.0.1:3101/api/integration/financial-summary"),
      request,
      "individual-user-jwt-with-sufficient-length",
      async () => Response.json({ ...response, correlationId: "40000000-0000-4000-8000-000000000004" }),
    ),
    /datos financieros incompatibles/u,
  );
});

test("el fixture I3 es contractual, fijo y enlaza únicamente datos recibidos", () => {
  assert.deepEqual(uiSpecificationSchema.parse(i3FinancialSummarySpecification), i3FinancialSummarySpecification);
  const serialized = JSON.stringify(i3FinancialSummarySpecification);
  assert.match(serialized, /financialSummary\.summaries\.0\.totalIncome/u);
  assert.match(serialized, /financialSummary\.summaries\.0\.totalExpenses/u);
  assert.doesNotMatch(serialized, /25000|18100|6900/u);
  const formatter = readFileSync(new URL(
    "../src/features/generative-ui/data-binding/formatting/format-data-value.ts",
    import.meta.url,
  ), "utf8");
  assert.match(formatter, /contractualFinancialAmountPattern/u);
  assert.match(formatter, /financialDisplayNumber\(value\)/u);
});

test("las rutas conservan JWT y refresh token en cookies HttpOnly estrictas", () => {
  const cookies = readFileSync(new URL("../src/features/auth/server/session-cookies.ts", import.meta.url), "utf8");
  const authRoute = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  const dataRoute = readFileSync(new URL("../src/app/api/integration/financial-summary/route.ts", import.meta.url), "utf8");
  assert.match(cookies, /httpOnly: true/u);
  assert.match(cookies, /sameSite: "strict"/u);
  assert.match(authRoute, /writeSessionCookies\(response, session\)/u);
  assert.doesNotMatch(authRoute, /accessToken: session\.accessToken/u);
  assert.match(dataRoute, /readSessionCookies\(request\)/u);
  assert.match(dataRoute, /if \(cookies\.refreshToken\)/u);
  assert.doesNotMatch(dataRoute, /AGENT_API_TOKEN/u);
});

test("la ruta principal renueva preventivamente una sesión expirada", () => {
  const now = Date.UTC(2026, 8, 12, 12, 0, 0);
  const jwt = (expiresAtSeconds: number) => [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify({ exp: expiresAtSeconds })).toString("base64url"),
    "signature",
  ].join(".");

  assert.equal(accessTokenNeedsRefresh(jwt(now / 1_000 + 30), now), true);
  assert.equal(accessTokenNeedsRefresh(jwt(now / 1_000 + 3_600), now), false);
  assert.equal(accessTokenNeedsRefresh("malformed-token", now), true);

  const agentRoute = readFileSync(new URL("../src/app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(agentRoute, /refreshSupabaseSession\(cookies\.refreshToken\)/u);
  assert.match(agentRoute, /writeSessionCookies\(response, refreshedSession\)/u);
  assert.doesNotMatch(agentRoute, /accessToken:\s*refreshedSession\.accessToken/u);
});
