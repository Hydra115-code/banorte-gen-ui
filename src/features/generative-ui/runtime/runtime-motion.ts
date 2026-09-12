import type { Transition, Variants } from "motion/react";

export type RuntimeMotionVariant =
  | "appear"
  | "update"
  | "remove"
  | "reorder"
  | "highlight"
  | "expand"
  | "collapse"
  | "stable";

const quickTransition: Transition = {
  duration: 0.18,
  ease: [0.2, 0, 0, 1],
};

const layoutTransition: Transition = {
  layout: {
    duration: 0.24,
    ease: [0.2, 0, 0, 1],
  },
};

/**
 * The runtime owns this vocabulary. UI specifications can never provide motion
 * values, durations, easing curves, or arbitrary CSS.
 */
export const runtimeMotionVariants = {
  appear: {
    opacity: 0,
    scale: 0.995,
    y: 8,
  },
  stable: {
    opacity: 1,
    scale: 1,
    y: 0,
    boxShadow: "0 0 0 0 rgba(235, 0, 69, 0)",
    transition: quickTransition,
  },
  update: {
    opacity: 1,
    scale: 1,
    y: 0,
    boxShadow: [
      "0 0 0 0 rgba(235, 0, 69, 0)",
      "0 0 0 3px rgba(235, 0, 69, 0.10)",
      "0 0 0 0 rgba(235, 0, 69, 0)",
    ],
    transition: { duration: 0.32, ease: [0.2, 0, 0, 1] },
  },
  remove: {
    opacity: 0,
    scale: 0.997,
    y: -4,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
  reorder: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: layoutTransition,
  },
  highlight: {
    opacity: 0.76,
    scale: 0.997,
    y: 0,
    boxShadow: "0 0 0 3px rgba(235, 0, 69, 0.08)",
    transition: quickTransition,
  },
  expand: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.22, ease: [0.2, 0, 0, 1] },
  },
  collapse: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
} satisfies Record<RuntimeMotionVariant, Variants[string]>;

export const reducedRuntimeMotionVariants = Object.fromEntries(
  Object.keys(runtimeMotionVariants).map((variant) => [variant, {
    opacity: variant === "remove" || variant === "collapse" ? 0 : 1,
    height: variant === "collapse" ? 0 : "auto",
    scale: 1,
    y: 0,
    transition: { duration: 0 },
  }]),
) as Record<RuntimeMotionVariant, Variants[string]>;
