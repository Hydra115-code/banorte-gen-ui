import {
  errorPayloadSchema,
  financialSummaryRequestSchema,
  financialSummaryResponseSchema,
  type FinancialSummaryRequest,
  type FinancialSummaryResponse,
} from "@banorte/contracts";

const MAX_FINANCIAL_RESPONSE_BYTES = 1_000_000;

export class FinancialSummaryIntegrationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly recoverable: boolean;

  constructor(message: string, code: string, status: number, recoverable: boolean) {
    super(message);
    this.name = "FinancialSummaryIntegrationError";
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

export async function fetchFinancialSummary(
  endpoint: URL,
  request: FinancialSummaryRequest,
  accessToken: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<FinancialSummaryResponse> {
  const validatedRequest = financialSummaryRequestSchema.parse(request);
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Correlation-ID": validatedRequest.correlationId,
      },
      body: JSON.stringify(validatedRequest),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new FinancialSummaryIntegrationError(
      "No fue posible contactar al backend",
      "backend_unavailable",
      503,
      true,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_FINANCIAL_RESPONSE_BYTES) {
    throw new FinancialSummaryIntegrationError(
      "El backend excedió el tamaño de respuesta permitido",
      "response_too_large",
      502,
      false,
    );
  }
  const rawBody = await response.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_FINANCIAL_RESPONSE_BYTES) {
    throw new FinancialSummaryIntegrationError(
      "El backend excedió el tamaño de respuesta permitido",
      "response_too_large",
      502,
      false,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    throw new FinancialSummaryIntegrationError(
      "El backend devolvió una respuesta inválida",
      "invalid_financial_response",
      502,
      false,
    );
  }

  if (!response.ok) {
    const error = errorPayloadSchema.safeParse(body);
    throw new FinancialSummaryIntegrationError(
      error.success ? error.data.message : "El backend rechazó la solicitud",
      error.success ? error.data.code : "backend_rejected",
      response.status,
      error.success ? error.data.recoverable : response.status >= 500,
    );
  }

  const result = financialSummaryResponseSchema.safeParse(body);
  if (!result.success || result.data.correlationId !== validatedRequest.correlationId) {
    throw new FinancialSummaryIntegrationError(
      "El backend devolvió datos financieros incompatibles",
      "invalid_financial_response",
      502,
      false,
    );
  }
  return result.data;
}
