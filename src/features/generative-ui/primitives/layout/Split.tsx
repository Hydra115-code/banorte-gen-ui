import type { SplitNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type SplitProps = LayoutPrimitiveProps & Pick<SplitNode, "ratio" | "collapseAt" | "gap">;

export function Split({ children, ratio = "equal", collapseAt = "md", gap = "lg" }: SplitProps) {
  return (
    <div className={`ui-split ${variantClass("ui-split", "ratio", ratio)} ${variantClass("ui-split", "collapse", collapseAt)} ${variantClass("ui", "gap", gap)}`}>
      {children}
    </div>
  );
}
