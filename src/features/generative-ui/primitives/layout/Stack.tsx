import type { StackNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type StackProps = LayoutPrimitiveProps & Pick<StackNode, "gap" | "align">;

export function Stack({ children, gap = "md", align = "stretch" }: StackProps) {
  return (
    <div className={`ui-stack ${variantClass("ui", "gap", gap)} ${variantClass("ui", "align", align)}`}>
      {children}
    </div>
  );
}
