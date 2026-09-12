"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { TabsNode } from "../../schemas/layout-node";
import { reducedRuntimeMotionVariants, runtimeMotionVariants } from "../../runtime/runtime-motion";

interface TabRenderItem extends Omit<TabsNode["items"][number], "children"> {
  children: ReactNode;
}

interface TabsProps extends Pick<TabsNode, "ariaLabel" | "defaultValue"> {
  id?: string;
  items: TabRenderItem[];
}

export function Tabs({ ariaLabel, defaultValue, id, items }: TabsProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const [activeValue, setActiveValue] = useState(defaultValue ?? items[0]?.value);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!items.some((item) => item.value === activeValue)) {
      setActiveValue(defaultValue && items.some((item) => item.value === defaultValue) ? defaultValue : items[0]?.value);
    }
  }, [activeValue, defaultValue, items]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else return;

    event.preventDefault();
    setActiveValue(items[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="ui-tabs" data-generated-node-id={id}>
      <div aria-label={ariaLabel} className="ui-tabs__list" role="tablist">
        {items.map((item, index) => {
          const selected = item.value === activeValue;

          return (
            <button
              aria-controls={`${baseId}-panel-${item.value}`}
              aria-selected={selected}
              className="ui-tabs__tab"
              id={`${baseId}-tab-${item.value}`}
              key={item.value}
              ref={(element) => { tabRefs.current[index] = element; }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => setActiveValue(item.value)}
              onKeyDown={(event) => moveFocus(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {items.map((item) => item.value === activeValue ? (
          <m.div
            animate="stable"
            aria-labelledby={`${baseId}-tab-${item.value}`}
            className="ui-tabs__panel"
            exit="remove"
            id={`${baseId}-panel-${item.value}`}
            initial="appear"
            key={item.value}
            role="tabpanel"
            tabIndex={0}
            variants={reduceMotion ? reducedRuntimeMotionVariants : runtimeMotionVariants}
          >
            {item.children}
          </m.div>
        ) : null)}
      </AnimatePresence>
    </div>
  );
}
