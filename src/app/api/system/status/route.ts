import { errorPayloadSchema } from "@banorte/contracts";
import {
  IntegrationConfigurationError,
  requestBackendSystemStatus,
} from "@/features/system-status/server/backend-system-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    return Response.json(await requestBackendSystemStatus(fetch, correlationId), {
      headers: responseHeaders(correlationId),
    });
  } catch (error) {
    const isConfigurationError = error instanceof IntegrationConfigurationError;
    return Response.json(errorPayloadSchema.parse({
      version: "1",
      code: isConfigurationError ? "integration_not_configured" : "backend_unavailable",
      message: isConfigurationError ? "La integración del agente no está configurada" : "El backend no está disponible",
      recoverable: !isConfigurationError,
      hasPartialData: false,
      correlationId,
    }), {
      status: 503,
      headers: responseHeaders(correlationId),
    });
  }
}

function responseHeaders(correlationId: string): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Correlation-ID": correlationId,
  };
}
