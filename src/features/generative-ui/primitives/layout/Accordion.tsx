"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { AccordionNode } from "../../schemas/layout-node";
import { reducedRuntimeMotionVariants, runtimeMotionVariants } from "../../runtime/runtime-motion";

interface AccordionRenderItem extends Omit<AccordionNode["items"][number], "children"> {
  children: ReactNode;
}

interface AccordionProps extends Pick<AccordionNode, "mode" | "defaultOpen"> {
  id?: string;
  items: AccordionRenderItem[];
}

export function Accordion({ id, mode = "single", defaultOpen = [], items }: AccordionProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const [openValues, setOpenValues] = useState(() => new Set(defaultOpen));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const available = new Set(items.map((item) => item.value));
    setOpenValues((current) => {
      const retained = [...current].filter((value) => available.has(value));
      const next = new Set(mode === "single" ? retained.slice(0, 1) : retained);
      return next.size === current.size && [...next].every((value) => current.has(value)) ? current : next;
    });
  }, [items, mode]);

  function toggle(value: string) {
    setOpenValues((current) => {
      const isOpen = current.has(value);
      const next = mode === "single" ? new Set<string>() : new Set(current);

      if (!isOpen) next.add(value);
      else next.delete(value);

      return next;
    });
  }

  return (
    <div className="ui-accordion" data-generated-node-id={id}>
      {items.map((item) => {
        const isOpen = openValues.has(item.value);
        const buttonId = `${baseId}-trigger-${item.value}`;
        const panelId = `${baseId}-panel-${item.value}`;

        return (
          <div className="ui-accordion__item" key={item.value}>
            <h3 className="ui-accordion__heading">
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                className="ui-accordion__trigger"
                id={buttonId}
                type="button"
                onClick={() => toggle(item.value)}
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="ui-accordion__indicator">+</span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <m.div
                  animate="expand"
                  aria-labelledby={buttonId}
                  className="ui-accordion__panel"
                  exit="collapse"
                  id={panelId}
                  initial="collapse"
                  key={item.value}
                  role="region"
                  variants={reduceMotion ? reducedRuntimeMotionVariants : runtimeMotionVariants}
                >
                  {item.children}
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
