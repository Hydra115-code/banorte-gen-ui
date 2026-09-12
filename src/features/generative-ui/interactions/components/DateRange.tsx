"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateDateValue } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type DateRangeNode = Extract<InteractionNode, { type: "dateRange" }>;

export function DateRange({ id, label, event, initialValue, min, max, required, helpText, disabled }: DateRangeNode) {
  const [value, setValue] = useState({ start: initialValue?.start ?? "", end: initialValue?.end ?? "" });
  const emit = useInteractionEvent(id, event);
  const dateError = validateDateValue(value.start, required, min, max) ?? validateDateValue(value.end, required, min, max);
  const rangeError = value.start && value.end && value.start > value.end ? "El inicio debe ser anterior al fin" : null;
  const error = dateError ?? rangeError;
  const messageId = `${id}-message`;

  function update(part: "start" | "end", partValue: string) {
    const nextValue = { ...value, [part]: partValue };
    const nextDateError = validateDateValue(nextValue.start, required, min, max) ?? validateDateValue(nextValue.end, required, min, max);
    const nextRangeError = nextValue.start && nextValue.end && nextValue.start > nextValue.end;
    setValue(nextValue);
    if ((nextValue.start && nextValue.end) || (!nextValue.start && !nextValue.end)) {
      emit(nextValue, !nextDateError && !nextRangeError);
    }
  }

  return (
    <fieldset aria-describedby={helpText || error ? messageId : undefined} aria-invalid={Boolean(error)} className="ui-field ui-date-range" disabled={disabled} id={id}>
      <legend>{label}</legend>
      <div className="ui-date-range__inputs">
        <label htmlFor={`${id}-start`}><span>Desde</span><input aria-describedby={helpText || error ? messageId : undefined} aria-invalid={Boolean(error)} id={`${id}-start`} max={max} min={min} required={required} type="date" value={value.start} onChange={(changeEvent) => update("start", changeEvent.target.value)} /></label>
        <label htmlFor={`${id}-end`}><span>Hasta</span><input aria-describedby={helpText || error ? messageId : undefined} aria-invalid={Boolean(error)} id={`${id}-end`} max={max} min={min} required={required} type="date" value={value.end} onChange={(changeEvent) => update("end", changeEvent.target.value)} /></label>
      </div>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </fieldset>
  );
}
