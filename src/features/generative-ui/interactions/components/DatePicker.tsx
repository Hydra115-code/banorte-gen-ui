"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateDateValue } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type DatePickerNode = Extract<InteractionNode, { type: "datePicker" }>;

export function DatePicker({ id, label, event, initialValue = "", min, max, required, helpText, disabled }: DatePickerNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = validateDateValue(value, required, min, max);
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
        type="date"
        value={value}
        onChange={(changeEvent) => {
          const nextValue = changeEvent.target.value;
          const nextError = validateDateValue(nextValue, required, min, max);
          setValue(nextValue);
          emit(nextValue || null, !nextError);
        }}
      />
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
