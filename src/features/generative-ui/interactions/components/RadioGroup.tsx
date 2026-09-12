"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type RadioGroupNode = Extract<InteractionNode, { type: "radioGroup" }>;

export function RadioGroup({ id, label, event, options, initialValue = "", required, orientation = "vertical", helpText, disabled }: RadioGroupNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = required && !value ? "Selecciona una opción" : null;
  const messageId = `${id}-message`;

  return (
    <fieldset aria-describedby={helpText || error ? messageId : undefined} aria-invalid={Boolean(error)} className={`ui-field ui-radio-group ui-radio-group--${orientation}`} disabled={disabled} id={id}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label key={option.value}>
            <input
              checked={value === option.value}
              disabled={option.disabled}
              name={id}
              required={required}
              type="radio"
              value={option.value}
              onChange={(changeEvent) => {
                setValue(changeEvent.target.value);
                emit(changeEvent.target.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </fieldset>
  );
}
