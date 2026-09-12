import { NextRequest, NextResponse } from "next/server";
import {
  errorPayloadSchema,
  financialSummaryRequestSchema,
} from "@banorte/contracts";
import {
  refreshSupabaseSession,
  SupabaseAuthenticationError,
} from "@/features/auth/server/supabase-session";
import {
  clearSessionCookies,
  readSessionCookies,
  writeSessionCookies,
} from "@/features/auth/server/session-cookies";
import {
  FinancialSummaryIntegrationError,
  requestFinancialSummary,
} from "@/features/integration/server/financial-summary-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4_096;

export async function POST(request: NextRequest) {
  const fallbackCorrelationId = crypto.randomUUID();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return integrationError(413, "request_too_large", "La solicitud excede el tamaño permitido", false, fallbackCorrelationId);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return integrationError(413, "request_too_large", "La solicitud excede el tamaño permitido", false, fallbackCorrelationId);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return integrationError(400, "invalid_request", "Solicitud inválida", false, fallbackCorrelationId);
  }
  const parsedRequest = financialSummaryRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return integrationError(400, "invalid_request", "Solicitud inválida", false, fallbackCorrelationId);
  }

  const correlationId = parsedRequest.data.correlationId;
  const cookies = readSessionCookies(request);
  if (!cookies.accessToken) {
    if (cookies.refreshToken) {
      return retryWithRefreshedSession(parsedRequest.data, cookies.refreshToken);
    }
    return integrationError(401, "authentication_required", "Autenticación requerida", false, correlationId);
  }

  try {
    const summary = await requestFinancialSummary(parsedRequest.data, cookies.accessToken);
    return NextResponse.json(summary, { headers: responseHeaders(correlationId) });
  } catch (error) {
    if (error instanceof FinancialSummaryIntegrationError
      && error.status === 401
      && cookies.refreshToken) {
      return retryWithRefreshedSession(parsedRequest.data, cookies.refreshToken);
    }
    return mapIntegrationError(error, correlationId);
  }
}

async function retryWithRefreshedSession(
  request: Parameters<typeof requestFinancialSummary>[0],
  refreshToken: string,
) {
  try {
    const session = await refreshSupabaseSession(refreshToken);
    const summary = await requestFinancialSummary(request, session.accessToken);
    const response = NextResponse.json(summary, { headers: responseHeaders(request.correlationId) });
    writeSessionCookies(response, session);
    return response;
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError) {
      const response = integrationError(
        401,
        "authentication_required",
        "La sesión expiró; inicia sesión nuevamente",
        false,
        request.correlationId,
      );
      clearSessionCookies(response);
      return response;
    }
    return mapIntegrationError(error, request.correlationId);
  }
}

function mapIntegrationError(error: unknown, correlationId: string) {
  if (error instanceof FinancialSummaryIntegrationError) {
    return integrationError(error.status, error.code, error.message, error.recoverable, correlationId);
  }
  return integrationError(502, "financial_data_unavailable", "No fue posible obtener los datos financieros", true, correlationId);
}

function integrationError(
  status: number,
  code: string,
  message: string,
  recoverable: boolean,
  correlationId: string,
) {
  return NextResponse.json(errorPayloadSchema.parse({
    version: "1",
    code,
    message,
    recoverable,
    hasPartialData: false,
    correlationId,
  }), { status, headers: responseHeaders(correlationId) });
}

function responseHeaders(correlationId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Correlation-ID": correlationId,
  };
}
