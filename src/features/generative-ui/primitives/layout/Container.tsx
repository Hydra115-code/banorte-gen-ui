import type { ContainerNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type ContainerProps = LayoutPrimitiveProps & Pick<ContainerNode, "size" | "padding">;

export function Container({ children, size = "lg", padding = "md" }: ContainerProps) {
  return (
    <div className={`ui-container ${variantClass("ui-container", "size", size)} ${variantClass("ui-container", "padding", padding)}`}>
      {children}
    </div>
  );
}
