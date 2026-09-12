import type { ProgressNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";

interface ProgressProps extends Omit<ProgressNode, "type"> {
  value?: number;
}

export function Progress({
  label,
  value,
  semanticState = "status.info",
  showValue = false,
}: ProgressProps) {
  const normalizedValue = value === undefined ? undefined : Math.min(100, Math.max(0, value));

  return (
    <div className={`ui-progress ${semanticStateClass(semanticState)}`}>
      <div className="ui-progress__label">
        <span>{label}</span>
        {showValue && normalizedValue !== undefined ? <span>{Math.round(normalizedValue)}%</span> : null}
      </div>
      <progress aria-label={label} max={100} value={normalizedValue} />
    </div>
  );
}
