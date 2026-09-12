"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type SwitchNode = Extract<InteractionNode, { type: "switch" }>;

export function Switch({ id, label, event, initialChecked = false, helpText, disabled }: SwitchNode) {
  const [checked, setChecked] = useState(initialChecked);
  const emit = useInteractionEvent(id, event);

  return (
    <div className="ui-field ui-field--choice">
      <div className="ui-switch-row">
        <span id={`${id}-label`}>{label}</span>
        <button aria-checked={checked} aria-describedby={helpText ? `${id}-message` : undefined} aria-labelledby={`${id}-label`} className="ui-switch" disabled={disabled} id={id} role="switch" type="button" onClick={() => { const next = !checked; setChecked(next); emit(next); }}><span /></button>
      </div>
      <FieldMessage helpText={helpText} id={`${id}-message`} />
    </div>
  );
}
