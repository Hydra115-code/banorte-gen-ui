"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type CheckboxNode = Extract<InteractionNode, { type: "checkbox" }>;

export function Checkbox({ id, label, event, initialChecked = false, required, helpText, disabled }: CheckboxNode) {
  const [checked, setChecked] = useState(initialChecked);
  const emit = useInteractionEvent(id, event);
  const error = required && !checked ? "Esta opción es obligatoria" : null;
  const messageId = `${id}-message`;

  return (
    <div className="ui-field ui-field--choice">
      <label htmlFor={id}><input aria-describedby={helpText || error ? messageId : undefined} aria-invalid={Boolean(error)} checked={checked} disabled={disabled} id={id} required={required} type="checkbox" onChange={(changeEvent) => { setChecked(changeEvent.target.checked); emit(changeEvent.target.checked, !required || changeEvent.target.checked); }} /><span>{label}</span></label>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
