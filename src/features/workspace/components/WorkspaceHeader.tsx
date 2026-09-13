"use client";

import Image from "next/image";
import { useWorkspaceStore } from "../state/workspace-store";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";

export function WorkspaceHeader({ onSignOut }: { onSignOut?: () => Promise<void> }) {
  const status = useWorkspaceStore((state) => state.experience.status);
  const reset = useWorkspaceStore((state) => state.reset);
  const { startNewSession } = useAgentSession();
  const hasStarted = status !== "empty";

  return (
    <header className="workspace-header">
      <div className="workspace-header__identity">
        <span className="brand-logo workspace-header__brand">
          <Image alt="Banorte" className="brand-logo__image" src="/banorte-logo.png" width={1920} height={236} priority />
        </span>
        <span className="workspace-header__divider" aria-hidden="true" />
        <span className="workspace-header__product">Banca personal</span>
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
        {onSignOut ? <button className="session-reset" type="button" onClick={() => void onSignOut()}>Salir</button> : null}
      </div>
    </header>
  );
}
