"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateNumberValue } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type NumberInputNode = Extract<InteractionNode, { type: "numberInput" }>;

export function NumberInput({ id, label, event, initialValue, min, max, step, required, helpText, disabled }: NumberInputNode) {
  const [value, setValue] = useState(initialValue === undefined ? "" : String(initialValue));
  const emit = useInteractionEvent(id, event);
  const error = validateNumberValue(value, { required, min, max });
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={helpText || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        required={required}
        step={step}
        type="number"
        value={value}
        onChange={(changeEvent) => {
          const nextValue = changeEvent.target.value;
          const nextError = validateNumberValue(nextValue, { required, min, max });
          setValue(nextValue);
          emit(nextValue === "" ? null : Number(nextValue), !nextError);
        }}
      />
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
