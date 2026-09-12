import type { BadgeNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";

type BadgeProps = Omit<BadgeNode, "type">;

export function Badge({ label, semanticState = "financial.neutral", emphasis = "soft" }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${emphasis} ${semanticStateClass(semanticState)}`}>{label}</span>;
}
