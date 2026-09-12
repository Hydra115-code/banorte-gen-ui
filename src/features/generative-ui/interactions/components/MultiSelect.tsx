"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateSelectionCount } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type MultiSelectNode = Extract<InteractionNode, { type: "multiSelect" }>;

export function MultiSelect({ id, label, event, options, initialValue = [], minSelections, maxSelections, helpText, disabled }: MultiSelectNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = validateSelectionCount(value.length, minSelections, maxSelections);
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <select
        aria-describedby={helpText || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        multiple
        value={value}
        onChange={(changeEvent) => {
          const nextValue = Array.from(changeEvent.target.selectedOptions, (option) => option.value);
          const nextError = validateSelectionCount(nextValue.length, minSelections, maxSelections);
          setValue(nextValue);
          emit(nextValue, !nextError);
        }}
      >
        {options.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </div>
  );
}
