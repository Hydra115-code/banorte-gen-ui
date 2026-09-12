export type InteractionKind = "analysis" | "simulation" | "visual" | "financial_action";

export interface InteractionPolicyDecision {
  kind: InteractionKind;
  delivery: "agent" | "local" | "blocked";
}

const VISUAL_EVENT = /^(?:ui\.(?:accordion|tab)\.|view\.|table\.(?:filter|page|sort)\.)/u;
const SIMULATION_EVENT = /^(?:budget|credit|education|savings|scenario|simulation)\./u;
const FINANCIAL_NAMESPACE = /^(?:card|cards|payment|payments|transaction|transactions|transfer|transfers)\./u;
const AUTHORITATIVE_ACTION = /(?:^|\.)(?:authorize|cancel|confirm|execute|pay|retry|send|submit)(?:_|\.|$)/u;
const SAFE_PAYMENT_PREPARATION_EVENT = /^payment\.(?:draft|review)\.(?:cancel|edit)(?:_|\.|$)/u;

/**
 * Frontend safety policy. The event contract remains unchanged: this only decides
 * whether a valid intent may leave the browser.
 */
export function classifyInteractionEvent(name: string): InteractionPolicyDecision {
  if (name === "form.value.changed") return { kind: "visual", delivery: "local" };
  if (VISUAL_EVENT.test(name)) return { kind: "visual", delivery: "local" };
  if (SAFE_PAYMENT_PREPARATION_EVENT.test(name)) return { kind: "analysis", delivery: "agent" };
  if (FINANCIAL_NAMESPACE.test(name) && AUTHORITATIVE_ACTION.test(name)) {
    return { kind: "financial_action", delivery: "blocked" };
  }
  if (SIMULATION_EVENT.test(name)) return { kind: "simulation", delivery: "agent" };
  return { kind: "analysis", delivery: "agent" };
}
