import type { ScrollableNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type ScrollableProps = LayoutPrimitiveProps & Pick<ScrollableNode, "ariaLabel" | "axis" | "maxSize"> & { id?: string };

export function Scrollable({ children, ariaLabel, axis = "vertical", id, maxSize = "md" }: ScrollableProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={`ui-scrollable ${variantClass("ui-scrollable", "axis", axis)} ${variantClass("ui-scrollable", "max", maxSize)}`}
      data-generated-node-id={id}
      id={id}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
