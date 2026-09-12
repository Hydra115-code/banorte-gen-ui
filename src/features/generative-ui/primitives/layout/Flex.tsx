import type { FlexNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type FlexProps = LayoutPrimitiveProps & Pick<FlexNode, "direction" | "wrap" | "justify" | "align" | "gap">;

export function Flex({
  children,
  direction = "row",
  wrap = "wrap",
  justify = "start",
  align = "center",
  gap = "md",
}: FlexProps) {
  return (
    <div className={`ui-flex ${variantClass("ui-flex", "direction", direction)} ${variantClass("ui-flex", "wrap", wrap)} ${variantClass("ui", "justify", justify)} ${variantClass("ui", "align", align)} ${variantClass("ui", "gap", gap)}`}>
      {children}
    </div>
  );
}
