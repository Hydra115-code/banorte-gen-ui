"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { m, useAnimationControls, useReducedMotion } from "motion/react";
import type { UINode } from "../schemas/layout-node";
import {
  reducedRuntimeMotionVariants,
  runtimeMotionVariants,
  type RuntimeMotionVariant,
} from "./runtime-motion";

interface RuntimeMotionNodeProps {
  children: ReactNode;
  isPending?: boolean;
  node: UINode;
  position?: number;
}

export const INITIAL_RUNTIME_MOTION_STATE: RuntimeMotionVariant = "stable";

export function createNodeMotionSignature(node: UINode) {
  return JSON.stringify(node, (key, value: unknown) => (
    key === "children" || key === "template" || key === "empty" || key === "then" || key === "else"
      ? undefined
      : value
  ));
}

export function RuntimeMotionNode({ children, isPending = false, node, position }: RuntimeMotionNodeProps) {
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const signature = useMemo(() => createNodeMotionSignature(node), [node]);
  const previousSignature = useRef(signature);
  const previousPosition = useRef(position);
  const firstRender = useRef(true);
  const animationRun = useRef(0);
  const [motionState, setMotionState] = useState<RuntimeMotionVariant>(INITIAL_RUNTIME_MOTION_STATE);
  const [isEntering, setIsEntering] = useState(true);
  const variants = reduceMotion ? reducedRuntimeMotionVariants : runtimeMotionVariants;
  const shouldAnimateLayout = !reduceMotion
    && previousPosition.current !== undefined
    && position !== undefined
    && previousPosition.current !== position;

  useEffect(() => {
    animationRun.current += 1;
    const run = animationRun.current;
    const didUpdate = previousSignature.current !== signature;
    const didReorder = previousPosition.current !== undefined
      && position !== undefined
      && previousPosition.current !== position;
    previousSignature.current = signature;
    previousPosition.current = position;

    const nextState: RuntimeMotionVariant = isPending
      ? "highlight"
      : firstRender.current
        ? "stable"
        : didReorder
          ? "reorder"
          : didUpdate
            ? "update"
            : "stable";

    firstRender.current = false;
    setMotionState(nextState);

    void controls.start(nextState).then(() => {
      if (run !== animationRun.current || nextState === "stable" || isPending) return;
      setMotionState("stable");
      void controls.start("stable");
    });
  }, [controls, isPending, position, signature]);

  return (
    <m.div
      animate={controls}
      className="ui-runtime-motion-node"
      data-node-type={node.type}
      data-entering={isEntering || undefined}
      data-motion-state={motionState}
      exit="remove"
      initial={INITIAL_RUNTIME_MOTION_STATE}
      // Layout projection forces browser measurements for every mounted motion
      // node. Enable it only for an actual reorder; content updates retain their
      // lightweight highlight animation without measuring the complete tree.
      layout={shouldAnimateLayout ? "position" : false}
      variants={variants}
      onAnimationEnd={(event) => {
        if (event.currentTarget === event.target) setIsEntering(false);
      }}
    >
      {children}
    </m.div>
  );
}
