import type { GridNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type GridProps = LayoutPrimitiveProps & Pick<GridNode, "columns" | "gap" | "align">;

export function Grid({ children, columns = 2, gap = "md", align = "stretch" }: GridProps) {
  return (
    <div className={`ui-grid ${variantClass("ui-grid", "columns", columns)} ${variantClass("ui", "gap", gap)} ${variantClass("ui", "align", align)}`}>
      {children}
    </div>
  );
}
