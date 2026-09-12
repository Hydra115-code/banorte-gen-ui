import type { AlertNode } from "../../schemas/content-node";
import { Icon } from "./Icon";
import { semanticStateClass } from "./content-classes";

type AlertProps = Omit<AlertNode, "type">;

const iconByState = {
  "status.success": "success",
  "status.warning": "warning",
  "status.error": "error",
  "status.info": "info",
} as const;

export function Alert({ title, message, semanticState = "status.info" }: AlertProps) {
  return (
    <div
      aria-live={semanticState === "status.error" ? "assertive" : "polite"}
      className={`ui-alert ${semanticStateClass(semanticState)}`}
      role={semanticState === "status.error" ? "alert" : "status"}
    >
      <Icon name={iconByState[semanticState]} semanticState={semanticState} />
      <div>
        {title ? <p className="ui-alert__title">{title}</p> : null}
        <p className="ui-alert__message">{message}</p>
      </div>
    </div>
  );
}
