"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { FieldMessage } from "./FieldMessage";

type SliderNode = Extract<InteractionNode, { type: "slider" }>;

export function Slider({ id, label, event, initialValue, min, max, step = 1, showValue = true, helpText, disabled }: SliderNode) {
  const [value, setValue] = useState(initialValue ?? min);
  const emit = useInteractionEvent(id, event);

  function commitValue(nextValue: number) {
    emit(nextValue);
  }

  return (
    <div className="ui-field ui-field--slider">
      <div className="ui-field__label-row">
        <label htmlFor={id}>{label}</label>
        {showValue ? <output htmlFor={id}>{value}</output> : null}
      </div>
      <input
        aria-describedby={helpText ? `${id}-message` : undefined}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(changeEvent) => {
          const nextValue = Number(changeEvent.target.value);
          setValue(nextValue);
        }}
        onKeyUp={(keyboardEvent) => {
          if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home", "PageDown", "PageUp"].includes(keyboardEvent.key)) {
            commitValue(Number(keyboardEvent.currentTarget.value));
          }
        }}
        onPointerUp={(pointerEvent) => commitValue(Number(pointerEvent.currentTarget.value))}
      />
      <FieldMessage helpText={helpText} id={`${id}-message`} />
    </div>
  );
}
