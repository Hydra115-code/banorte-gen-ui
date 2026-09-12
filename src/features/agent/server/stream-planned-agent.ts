import "server-only";

import { dataRegistrySchema } from "../../generative-ui/data-binding/schemas/data-registry-schema";
import {
  type UIValidationError,
} from "../../generative-ui/schemas/ui-specification";
import type { AgentUIData } from "../contracts/agent-message";
import { createRepairContext, UI_PLANNER_CONTEXT } from "../planner/ui-planner";
import type { AgentApiEvent } from "./agent-api-event";
import type { AIProvider } from "./ai-provider";
import type { AgentUIIntent } from "../contracts/agent-ui-intent";
import type { SessionReference } from "@banorte/contracts";
import { identifyUISpecification } from "../../generative-ui/patches/stable-node-ids";
import {
  applyUIPatch,
  createUIPatchState,
  type UIPatchState,
} from "../../generative-ui/patches/ui-patch-engine";

const MAX_UI_REPAIR_ATTEMPTS = 1;

export type ValidatedAgentEvent =
  | Exclude<AgentApiEvent, { type: "ui" | "ui-started" | "ui-patch" | "ui-completed" }>
  | ({ type: "ui" } & AgentUIData["ui"])
  | ({ type: "ui-started" } & AgentUIData["uiStarted"])
  | { type: "ui-patch"; patch: AgentUIData["uiPatch"] }
  | ({ type: "ui-completed" } & AgentUIData["uiCompleted"]);

interface StreamPlannedAgentBaseOptions {
  provider: AIProvider;
  signal: AbortSignal;
  sessionId?: string;
  correlationId?: string;
  sessionState?: SessionReference;
}

type StreamPlannedAgentOptions = StreamPlannedAgentBaseOptions & (
  | { prompt: string; intent?: never; initialState?: never }
  | { prompt?: never; intent: AgentUIIntent; initialState: UIPatchState }
);

function validateUIEvent(event: Extract<AgentApiEvent, { type: "ui" | "ui-started" }>) {
  const specification = identifyUISpecification(event.specification);
  const data = event.data === undefined
    ? { success: true as const, data: undefined }
    : dataRegistrySchema.safeParse(event.data);

  const errors: UIValidationError[] = specification.errors.slice();
  if (!data.success) {
    errors.push(...data.error.issues.map((issue) => ({
      code: issue.code,
      path: ["data", ...issue.path],
      message: issue.message,
    })));
  }

  if (!specification.success || !data.success) return { success: false as const, errors };

  return {
    success: true as const,
    event: {
      type: "ui" as const,
      specification: specification.data,
      ...(data.data === undefined ? {} : { data: data.data }),
    },
  };
}

export async function* streamPlannedAgent(
  options: StreamPlannedAgentOptions,
): AsyncGenerator<ValidatedAgentEvent> {
  const { provider, signal } = options;
  const sessionId = options.sessionId ?? crypto.randomUUID();
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const input = options.intent
    ? { type: "ui-event" as const, intent: options.intent }
    : { type: "prompt" as const, prompt: options.prompt };
  let repair: ReturnType<typeof createRepairContext> | undefined;
  let patchState: UIPatchState | undefined = options.initialState;
  let hasPartialData = patchState !== undefined;

  for (let attempt = 0; attempt <= MAX_UI_REPAIR_ATTEMPTS; attempt += 1) {
    let invalidUI: UIValidationError[] | null = null;

    for await (const event of provider.stream({
      input,
      signal,
      sessionId,
      correlationId,
      planner: UI_PLANNER_CONTEXT,
      ...(options.sessionState ? { sessionState: options.sessionState } : {}),
      ...(repair ? { repair } : {}),
    })) {
      if (event.type === "ui" || event.type === "ui-started") {
        const validation = validateUIEvent(event);
        if (!validation.success) {
          invalidUI = validation.errors;
          break;
        }
        const initialState = createUIPatchState(
          validation.event.specification,
          event.type === "ui-started" ? event.revision : 0,
        );
        if (!initialState.success) {
          invalidUI = initialState.error.details ?? [];
          break;
        }
        patchState = initialState.state;
        hasPartialData = true;
        yield event.type === "ui-started"
          ? { ...validation.event, type: "ui-started", revision: event.revision }
          : validation.event;
        continue;
      }

      if (event.type === "ui-patch") {
        if (!patchState) {
          yield {
            type: "error",
            code: "ui_patch_without_root",
            message: "El agente envió cambios antes de iniciar la interfaz",
            recoverable: true,
            hasPartialData,
            correlationId,
          };
          return;
        }
        const result = applyUIPatch(patchState, event.patch);
        if (!result.success) {
          yield {
            type: "error",
            code: "ui_patch_invalid",
            message: "El agente intentó aplicar un cambio de interfaz inválido",
            recoverable: true,
            hasPartialData,
            correlationId,
          };
          return;
        }
        patchState = result.state;
        hasPartialData = true;
        yield event;
        continue;
      }

      if (event.type === "ui-completed") {
        if (!patchState || event.revision !== patchState.revision) {
          yield {
            type: "error",
            code: "ui_revision_conflict",
            message: "La interfaz terminó con una revisión inconsistente",
            recoverable: true,
            hasPartialData,
            correlationId,
          };
          return;
        }
        yield event;
        continue;
      }

      if (repair && event.type === "text-delta") continue;
      if (event.type === "data-available" || event.type === "data-patch") hasPartialData = true;
      yield event;
    }

    if (!invalidUI) return;

    if (attempt === MAX_UI_REPAIR_ATTEMPTS) {
      yield {
        type: "error",
        code: "ui_specification_invalid",
        message: "El agente no pudo generar una interfaz válida",
        recoverable: true,
        hasPartialData,
        correlationId,
      };
      return;
    }

    repair = createRepairContext(attempt + 1, invalidUI);
    yield {
      type: "status",
      stage: "generating_ui",
      message: "Ajustando la interfaz generada",
    };
  }
}
