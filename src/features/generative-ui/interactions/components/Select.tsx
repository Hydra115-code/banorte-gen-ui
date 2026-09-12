"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type SelectNode = Extract<InteractionNode, { type: "select" }>;

export function Select({ id, label, event, options, initialValue = "", placeholder, required, helpText, disabled }: SelectNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = required && !value ? "Selecciona una opción" : null;
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <select
        aria-describedby={helpText || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        required={required}
        value={value}
        onChange={(changeEvent) => {
          const nextValue = changeEvent.target.value;
          setValue(nextValue);
          emit(nextValue || null, !required || Boolean(nextValue));
        }}
      >
        <option value="">{placeholder ?? "Selecciona una opción"}</option>
        {options.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
