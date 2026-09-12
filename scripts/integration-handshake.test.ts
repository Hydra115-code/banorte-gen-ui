import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONTRACT_FINGERPRINT } from "@banorte/contracts";
import {
  requestSystemStatus,
  SystemStatusRequestError,
} from "../src/features/system-status/system-status-client.ts";

const statusPayload = {
  version: "1",
  contractFingerprint: CONTRACT_FINGERPRINT,
  status: "ok",
  backend: "ready",
  agent: "ready",
  mcp: "ready",
  checkedAt: "2026-09-12T16:00:00.000Z",
} as const;

test("acepta únicamente el fingerprint contractual canónico y propaga correlación", async () => {
  let receivedCorrelation: string | null = null;
  const status = await requestSystemStatus("http://127.0.0.1:3101/api/system/status", {
    correlationId: "10000000-0000-4000-8000-000000000001",
    fetchImplementation: async (_input, init) => {
      receivedCorrelation = new Headers(init?.headers).get("X-Correlation-ID");
      return Response.json(statusPayload);
    },
  });

  assert.equal(status.contractFingerprint, CONTRACT_FINGERPRINT);
  assert.equal(receivedCorrelation, "10000000-0000-4000-8000-000000000001");
});

test("rechaza un backend con fingerprint distinto sin reintento", async () => {
  let attempts = 0;
  await assert.rejects(
    requestSystemStatus("http://127.0.0.1:3101/api/system/status", {
      retries: 2,
      fetchImplementation: async () => {
        attempts += 1;
        return Response.json({ ...statusPayload, contractFingerprint: "a".repeat(64) });
      },
    }),
    (error: unknown) => error instanceof SystemStatusRequestError
      && error.code === "contract_fingerprint_mismatch"
      && !error.recoverable,
  );
  assert.equal(attempts, 1);
});

test("reintenta una falla transitoria una sola vez y recupera conexión", async () => {
  let attempts = 0;
  const status = await requestSystemStatus("http://127.0.0.1:3101/api/system/status", {
    retries: 1,
    fetchImplementation: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("connection refused");
      return Response.json(statusPayload);
    },
  });
  assert.equal(attempts, 2);
  assert.equal(status.status, "ok");
});

test("corta por timeout y devuelve un error distinguible", async () => {
  await assert.rejects(
    requestSystemStatus("http://127.0.0.1:3101/api/system/status", {
      timeoutMs: 5,
      fetchImplementation: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      }),
    }),
    (error: unknown) => error instanceof SystemStatusRequestError && error.code === "request_timeout",
  );
});

test("la ruta server-side expone correlación y la barra representa los tres estados", () => {
  const route = readFileSync(new URL("../src/app/api/system/status/route.ts", import.meta.url), "utf8");
  const bar = readFileSync(new URL("../src/features/system-status/components/SystemStatusBar.tsx", import.meta.url), "utf8");
  assert.match(route, /"X-Correlation-ID": correlationId/u);
  assert.match(route, /requestBackendSystemStatus\(fetch, correlationId\)/u);
  assert.match(bar, /data-connection="checking"/u);
  assert.match(bar, /data-connection="connected"/u);
  assert.match(bar, /data-connection="disconnected"/u);
});
