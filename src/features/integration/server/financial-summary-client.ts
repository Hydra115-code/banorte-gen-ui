import "server-only";

import type { FinancialSummaryRequest, FinancialSummaryResponse } from "@banorte/contracts";
import { readAgentApiConfig } from "../../agent/server/agent-api-config";
import {
  fetchFinancialSummary,
  FinancialSummaryIntegrationError,
} from "./financial-summary-wire";

export { FinancialSummaryIntegrationError } from "./financial-summary-wire";

export async function requestFinancialSummary(
  request: FinancialSummaryRequest,
  accessToken: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<FinancialSummaryResponse> {
  const config = readAgentApiConfig();
  if (!config) {
    throw new FinancialSummaryIntegrationError(
      "La integración de datos no está configurada",
      "integration_not_configured",
      503,
      false,
    );
  }

  const endpoint = new URL("/api/integration/financial-summary", config.endpoint);
  return fetchFinancialSummary(endpoint, request, accessToken, fetchImplementation);
}
