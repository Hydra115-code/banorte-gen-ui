"use client";

import { useWorkspaceStore } from "../state/workspace-store";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";

export function WorkspaceHeader() {
  const status = useWorkspaceStore((state) => state.experience.status);
  const reset = useWorkspaceStore((state) => state.reset);
  const { startNewSession } = useAgentSession();
  const hasStarted = status !== "empty";

  return (
    <header className="workspace-header">
      <div className="workspace-header__identity">
        <span className="workspace-header__brand" aria-label="Banorte">
          BANORTE
        </span>
        <span className="workspace-header__divider" aria-hidden="true" />
        <span className="workspace-header__product">Análisis financiero</span>
      </div>

      <div className="workspace-header__session">
        <span className="session-status">
          <span className="session-status__dot" aria-hidden="true" />
          Sesión protegida
        </span>
        <ThemeToggle />
        {hasStarted ? (
          <button className="session-reset" type="button" onClick={() => {
            startNewSession();
            reset();
          }}>
            Nueva consulta
          </button>
        ) : null}
      </div>
    </header>
  );
}
