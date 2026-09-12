"use client";

import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type ButtonNode = Extract<InteractionNode, { type: "button" }>;

export function Button({ id, label, event, variant = "primary", state = "idle", helpText, disabled }: ButtonNode) {
  const emit = useInteractionEvent(id, event);
  const isDisabled = disabled || state === "disabled" || state === "loading";

  return (
    <div className="ui-field">
      <button
        aria-busy={state === "loading"}
        aria-describedby={helpText ? `${id}-message` : undefined}
        className={`ui-control-button ui-control-button--${variant}`}
        disabled={isDisabled}
        id={id}
        type="button"
        onClick={() => emit(undefined)}
      >
        {state === "loading" ? "Procesando…" : label}
      </button>
      <FieldMessage helpText={helpText} id={`${id}-message`} />
    </div>
  );
}
