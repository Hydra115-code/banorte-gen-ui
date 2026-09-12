import "server-only";

import { z } from "zod";

const agentApiUrlSchema = z.string().url().transform((value, context) => {
  const url = new URL(value);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";

  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "El Agent API requiere HTTPS" });
    return z.NEVER;
  }

  if (url.username || url.password || url.hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La URL del Agent API no es segura" });
    return z.NEVER;
  }

  return url;
});

export interface AgentApiConfig {
  endpoint: URL;
  token?: string;
}

export function readAgentApiConfig(): AgentApiConfig | null {
  const result = agentApiUrlSchema.safeParse(process.env.AGENT_API_URL);
  if (!result.success) return null;

  const token = process.env.AGENT_API_TOKEN?.trim();
  return {
    endpoint: result.data,
    ...(token ? { token } : {}),
  };
}
