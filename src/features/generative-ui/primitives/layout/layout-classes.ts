import type { ReactNode } from "react";

export interface LayoutPrimitiveProps {
  children: ReactNode;
}

export function variantClass(block: string, variant: string, value: string | number) {
  return `${block}--${variant}-${value}`;
}
