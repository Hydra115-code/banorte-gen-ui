import type { SectionNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type SectionProps = LayoutPrimitiveProps & Pick<SectionNode, "ariaLabel" | "surface" | "padding">;

export function Section({ children, ariaLabel, surface = "transparent", padding = "none" }: SectionProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`ui-section ${variantClass("ui-section", "surface", surface)} ${variantClass("ui-section", "padding", padding)}`}
    >
      {children}
    </section>
  );
}
