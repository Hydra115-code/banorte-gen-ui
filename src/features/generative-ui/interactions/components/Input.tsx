"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateTextValue } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type InputNode = Extract<InteractionNode, { type: "input" }>;

export function Input({ id, label, event, initialValue = "", placeholder, validation, helpText, disabled }: InputNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = validateTextValue(value, validation);
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={helpText || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        maxLength={validation?.maxLength}
        minLength={validation?.minLength}
        placeholder={placeholder}
        required={validation?.required}
        type={validation?.kind === "email" ? "email" : validation?.kind === "search" ? "search" : "text"}
        value={value}
        onChange={(changeEvent) => {
          const nextValue = changeEvent.target.value;
          const nextError = validateTextValue(nextValue, validation);
          setValue(nextValue);
          emit(nextValue, !nextError);
        }}
      />
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
