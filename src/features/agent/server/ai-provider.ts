import type { AgentApiEvent } from "./agent-api-event";
import type { UIPlannerContext, UIRepairContext } from "../planner/ui-planner";
import type { AgentUIIntent } from "../contracts/agent-ui-intent";
import type { SessionReference } from "@banorte/contracts";

export type AIProviderId = "google" | "openai";

export type AIProviderInput =
  | { type: "prompt"; prompt: string }
  | { type: "ui-event"; intent: AgentUIIntent };

export interface AIProviderRequest {
  accessToken?: string;
  input: AIProviderInput;
  signal: AbortSignal;
  sessionId: string;
  correlationId: string;
  planner: UIPlannerContext;
  sessionState?: SessionReference;
  repair?: UIRepairContext;
  responseMode?: "text" | "complete-ui";
  timeoutMs?: number;
}

export interface AIProvider {
  readonly id: AIProviderId;
  stream(request: AIProviderRequest): AsyncGenerator<AgentApiEvent>;
}
