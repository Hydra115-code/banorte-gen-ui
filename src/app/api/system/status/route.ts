import { errorPayloadSchema } from "@banorte/contracts";
import {
  IntegrationConfigurationError,
  requestBackendSystemStatus,
} from "@/features/system-status/server/backend-system-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await requestBackendSystemStatus(), {
      headers: responseHeaders(),
    });
  } catch (error) {
    const isConfigurationError = error instanceof IntegrationConfigurationError;
    return Response.json(errorPayloadSchema.parse({
      version: "1",
      code: isConfigurationError ? "integration_not_configured" : "backend_unavailable",
      message: isConfigurationError ? "La integración del agente no está configurada" : "El backend no está disponible",
      recoverable: !isConfigurationError,
      hasPartialData: false,
    }), {
      status: 503,
      headers: responseHeaders(),
    });
  }
}

function responseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
