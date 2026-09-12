import type { IconNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";

type IconProps = Omit<IconNode, "type">;

function IconPath({ name }: Pick<IconProps, "name">) {
  switch (name) {
    case "success":
      return <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>;
    case "warning":
      return <><path d="M10.3 3.6 2.4 17.3A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.7L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>;
    case "error":
      return <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>;
    case "trend-up":
      return <><path d="m4 16 5-5 4 4 7-7" /><path d="M15 8h5v5" /></>;
    case "trend-down":
      return <><path d="m4 8 5 5 4-4 7 7" /><path d="M15 16h5v-5" /></>;
    case "neutral":
      return <path d="M5 12h14" />;
    case "info":
      return <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>;
  }
}

export function Icon({ name, label, size = "md", semanticState = "status.info" }: IconProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`ui-icon ui-icon--${size} ${semanticStateClass(semanticState)}`}
      role={label ? "img" : undefined}
      viewBox="0 0 24 24"
    >
      <IconPath name={name} />
    </svg>
  );
}
