import "server-only";

import { z } from "zod";
import { readAgentApiConfig } from "./agent-api-config";
import { HttpAIProvider } from "./http-ai-provider";
import type { AIProvider, AIProviderId } from "./ai-provider";

const aiProviderIdSchema = z.enum(["google", "openai"]);

export function readAIProviderId(): AIProviderId | null {
  const result = aiProviderIdSchema.safeParse(process.env.AI_PROVIDER?.trim().toLowerCase());
  return result.success ? result.data : null;
}

export function getConfiguredAIProvider(): AIProvider | null {
  const id = readAIProviderId();
  const config = readAgentApiConfig();
  if (!id || !config) return null;

  return new HttpAIProvider(id, config);
}
