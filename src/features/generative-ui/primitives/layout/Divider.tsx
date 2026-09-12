import type { DividerNode } from "../../schemas/layout-node";
import { variantClass } from "./layout-classes";

type DividerProps = Pick<DividerNode, "orientation" | "strength">;

export function Divider({ orientation = "horizontal", strength = "subtle" }: DividerProps) {
  return (
    <div
      aria-orientation={orientation}
      className={`ui-divider ${variantClass("ui-divider", "orientation", orientation)} ${variantClass("ui-divider", "strength", strength)}`}
      role="separator"
    />
  );
}
