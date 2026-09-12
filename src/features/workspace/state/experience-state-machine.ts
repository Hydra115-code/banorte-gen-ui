export const experienceStatuses = [
  "empty",
  "submitting",
  "retrieving_data",
  "generating_ui",
  "ready",
  "updating",
  "awaiting_confirmation",
  "executing_action",
  "partial",
  "error",
  "cancelled",
] as const;

export type ExperienceStatus = (typeof experienceStatuses)[number];

export type ExperienceEvent =
  | { type: "SUBMIT" }
  | { type: "DATA_REQUESTED" }
  | { type: "UI_GENERATION_STARTED" }
  | { type: "UI_UPDATE_STARTED" }
  | { type: "UI_COMMITTED" }
  | { type: "PAYMENT_CONFIRMATION_REQUIRED" }
  | { type: "PAYMENT_CONFIRMED" }
  | { type: "PAYMENT_COMPLETED" }
  | { type: "PARTIAL_AVAILABLE" }
  | { type: "REVISION_CONFLICT" }
  | { type: "FAIL"; scope: "conversation" | "ui" | "data_registry" | "payment" }
  | { type: "CANCEL"; scope: "generation" | "payment" }
  | { type: "RESTORE_SESSION" }
  | { type: "RESET" };

export type ConversationStatus = "idle" | "submitting" | "active" | "error" | "cancelled";
export type UIRuntimeStatus = "empty" | "generating" | "stable" | "updating" | "partial" | "error";
export type DataRegistryStatus = "empty" | "retrieving" | "current" | "stale" | "error";
export type PaymentStatus = "idle" | "awaiting_confirmation" | "executing" | "completed" | "failed" | "cancelled";

export interface ExperienceDomains {
  conversation: ConversationStatus;
  ui: UIRuntimeStatus;
  dataRegistry: DataRegistryStatus;
  payment: PaymentStatus;
}

export interface ExperienceState {
  status: ExperienceStatus;
  domains: ExperienceDomains;
  /** Indica si existe una UI confirmada que debe conservarse durante actualizaciones, cancelaciones y errores. */
  hasValidSnapshot: boolean;
}

export type ExperienceTransition =
  | { accepted: true; state: ExperienceState }
  | { accepted: false; state: ExperienceState; reason: "invalid_transition" };

const initialDomains: ExperienceDomains = {
  conversation: "idle",
  ui: "empty",
  dataRegistry: "empty",
  payment: "idle",
};

export function createInitialExperienceState(): ExperienceState {
  return {
    status: "empty",
    domains: { ...initialDomains },
    hasValidSnapshot: false,
  };
}

const allowedEvents: Record<ExperienceStatus, ReadonlySet<ExperienceEvent["type"]>> = {
  empty: new Set(["SUBMIT", "RESTORE_SESSION", "RESET"]),
  submitting: new Set(["DATA_REQUESTED", "UI_GENERATION_STARTED", "UI_COMMITTED", "PARTIAL_AVAILABLE", "FAIL", "CANCEL", "RESET"]),
  retrieving_data: new Set(["UI_GENERATION_STARTED", "UI_UPDATE_STARTED", "UI_COMMITTED", "PARTIAL_AVAILABLE", "REVISION_CONFLICT", "FAIL", "CANCEL", "RESET"]),
  generating_ui: new Set(["UI_UPDATE_STARTED", "UI_COMMITTED", "PARTIAL_AVAILABLE", "REVISION_CONFLICT", "FAIL", "CANCEL", "RESET"]),
  ready: new Set(["SUBMIT", "UI_UPDATE_STARTED", "PAYMENT_CONFIRMATION_REQUIRED", "FAIL", "CANCEL", "RESTORE_SESSION", "RESET"]),
  updating: new Set(["DATA_REQUESTED", "UI_COMMITTED", "PAYMENT_CONFIRMATION_REQUIRED", "PARTIAL_AVAILABLE", "REVISION_CONFLICT", "FAIL", "CANCEL", "RESET"]),
  awaiting_confirmation: new Set(["PAYMENT_CONFIRMED", "CANCEL", "FAIL", "RESET"]),
  executing_action: new Set(["PAYMENT_COMPLETED", "PARTIAL_AVAILABLE", "FAIL", "RESET"]),
  partial: new Set(["SUBMIT", "UI_UPDATE_STARTED", "UI_COMMITTED", "RESTORE_SESSION", "RESET"]),
  error: new Set(["SUBMIT", "RESTORE_SESSION", "RESET"]),
  cancelled: new Set(["SUBMIT", "RESTORE_SESSION", "RESET"]),
};

function nextStatus(current: ExperienceState, event: ExperienceEvent): ExperienceStatus {
  switch (event.type) {
    case "SUBMIT":
      return current.hasValidSnapshot ? "updating" : "submitting";
    case "DATA_REQUESTED":
    case "REVISION_CONFLICT":
      return "retrieving_data";
    case "UI_GENERATION_STARTED":
      return current.hasValidSnapshot ? "updating" : "generating_ui";
    case "UI_UPDATE_STARTED":
      return "updating";
    case "UI_COMMITTED":
    case "PAYMENT_COMPLETED":
    case "RESTORE_SESSION":
      return "ready";
    case "PAYMENT_CONFIRMATION_REQUIRED":
      return "awaiting_confirmation";
    case "PAYMENT_CONFIRMED":
      return "executing_action";
    case "PARTIAL_AVAILABLE":
      return "partial";
    case "FAIL":
      return "error";
    case "CANCEL":
      return "cancelled";
    case "RESET":
      return "empty";
  }
}

function domainsFor(
  current: ExperienceState,
  event: ExperienceEvent,
  hasValidSnapshot: boolean,
): ExperienceDomains {
  const stableUi = hasValidSnapshot ? "stable" : "empty";
  const currentData = hasValidSnapshot ? "current" : "empty";
  const domains = { ...current.domains };

  switch (event.type) {
    case "RESET":
      return { ...initialDomains };
    case "SUBMIT":
      return { conversation: "submitting", ui: stableUi, dataRegistry: currentData, payment: "idle" };
    case "DATA_REQUESTED":
    case "REVISION_CONFLICT":
      return { ...domains, conversation: "active", ui: stableUi, dataRegistry: "retrieving" };
    case "UI_GENERATION_STARTED":
      return {
        ...domains,
        conversation: "active",
        ui: hasValidSnapshot ? "updating" : "generating",
        dataRegistry: currentData,
      };
    case "UI_UPDATE_STARTED":
      return { ...domains, conversation: "active", ui: "updating", dataRegistry: currentData };
    case "UI_COMMITTED":
      return { ...domains, conversation: "active", ui: "stable", dataRegistry: "current" };
    case "PAYMENT_CONFIRMATION_REQUIRED":
      return { ...domains, conversation: "active", ui: "stable", dataRegistry: "current", payment: "awaiting_confirmation" };
    case "PAYMENT_CONFIRMED":
      return { ...domains, payment: "executing" };
    case "PAYMENT_COMPLETED":
      return { ...domains, conversation: "active", ui: "stable", dataRegistry: "current", payment: "completed" };
    case "PARTIAL_AVAILABLE":
      return { ...domains, conversation: "active", ui: "partial", dataRegistry: hasValidSnapshot ? "stale" : "current" };
    case "FAIL":
      if (event.scope === "conversation") return { ...domains, conversation: "error" };
      if (event.scope === "ui") return { ...domains, ui: hasValidSnapshot ? "stable" : "error" };
      if (event.scope === "data_registry") return { ...domains, dataRegistry: "error" };
      return { ...domains, payment: "failed" };
    case "CANCEL":
      return event.scope === "payment"
        ? { ...domains, payment: "cancelled" }
        : { ...domains, conversation: "cancelled", ui: stableUi, dataRegistry: currentData };
    case "RESTORE_SESSION":
      return { conversation: "active", ui: "stable", dataRegistry: "current", payment: "idle" };
  }
}

export function transitionExperience(
  current: ExperienceState,
  event: ExperienceEvent,
): ExperienceTransition {
  if (!allowedEvents[current.status].has(event.type)) {
    return { accepted: false, state: current, reason: "invalid_transition" };
  }

  if (event.type === "RESET") {
    return { accepted: true, state: createInitialExperienceState() };
  }

  const status = nextStatus(current, event);
  const hasValidSnapshot = current.hasValidSnapshot
    || event.type === "UI_COMMITTED"
    || event.type === "PAYMENT_COMPLETED"
    || event.type === "RESTORE_SESSION";

  return {
    accepted: true,
    state: {
      status,
      domains: domainsFor(current, event, hasValidSnapshot),
      hasValidSnapshot,
    },
  };
}

export function isExperienceBusy(status: ExperienceStatus): boolean {
  return status === "submitting"
    || status === "retrieving_data"
    || status === "generating_ui"
    || status === "updating"
    || status === "executing_action";
}
