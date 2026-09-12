import type { ReactNode } from "react";
import type { MetricNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";

interface MetricProps extends Omit<
  MetricNode,
  | "type"
  | "label"
  | "labelBinding"
  | "valueBinding"
  | "format"
  | "valueType"
  | "fallback"
  | "trendBinding"
  | "comparisonBinding"
> {
  label: string;
  value?: ReactNode;
  trend?: ReactNode;
  comparison?: ReactNode;
}

export function Metric({
  label,
  value,
  trend,
  comparison,
  importance = "secondary",
  semanticState = "financial.neutral",
}: MetricProps) {
  const hasValue = value !== undefined && value !== null;
  const valueKey = typeof value === "string" || typeof value === "number"
    ? String(value)
    : "metric-value";

  return (
    <article
      aria-label={hasValue ? label : `${label}: sin datos disponibles`}
      className={`ui-metric ui-metric--${importance} ${semanticStateClass(semanticState)}`}
    >
      <p className="ui-metric__label">{label}</p>
      <p key={valueKey} aria-hidden={!hasValue} className="ui-metric__value">{hasValue ? value : "—"}</p>
      {trend || comparison ? (
        <div className="ui-metric__context">
          {trend ? <span>{trend}</span> : null}
          {comparison ? <span>{comparison}</span> : null}
        </div>
      ) : null}
    </article>
  );
}
