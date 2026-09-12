import "server-only";

import { requestSystemStatus } from "../system-status-client";
import { readAgentApiConfig } from "../../agent/server/agent-api-config";
import { readAIProviderId } from "../../agent/server/ai-provider-registry";

export function requestBackendSystemStatus(
  fetchImplementation: typeof fetch = fetch,
  correlationId = crypto.randomUUID(),
) {
  const config = readAgentApiConfig();
  const provider = readAIProviderId();
  if (!config || provider !== "google") throw new IntegrationConfigurationError();
  const endpoint = new URL("/api/system/status", config.endpoint);
  return requestSystemStatus(endpoint.toString(), {
    fetchImplementation,
    timeoutMs: 3_000,
    retries: 1,
    correlationId,
  });
}

export class IntegrationConfigurationError extends Error {
  constructor() {
    super("La integración del agente no está configurada");
    this.name = "IntegrationConfigurationError";
  }
}
