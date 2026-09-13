"use client";

import { GenerativeCanvas } from "./GenerativeCanvas";
import { PromptComposer } from "./PromptComposer";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AgentSessionProvider } from "../../agent/components/AgentSessionProvider";
import { SystemStatusBar } from "../../system-status/components/SystemStatusBar";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";
import { AnalysisHistory } from "./AnalysisHistory";
import { shouldExposeRuntimeDiagnostics } from "../../../shared/security/runtime-diagnostics-visibility";
import type { ReactNode } from "react";
import { SessionAccessGate } from "@/features/auth/components/SessionAccessGate";

interface AppShellProps {
  diagnostics?: ReactNode;
  showDeveloperDiagnostics?: boolean;
}

export function AppShell({ diagnostics, showDeveloperDiagnostics = false }: AppShellProps = {}) {
  const diagnosticsEnabled = shouldExposeRuntimeDiagnostics(process.env.NODE_ENV, showDeveloperDiagnostics);

  return (
    <WorkspaceErrorBoundary>
      <SessionAccessGate>
        {({ ownerKey, signOut }) => (
          <AgentSessionProvider key={ownerKey} ownerKey={ownerKey}>
            {diagnostics}
            <main className="workspace" data-developer-diagnostics={diagnosticsEnabled || undefined}>
              <WorkspaceHeader onSignOut={signOut} />
              {diagnosticsEnabled ? <SystemStatusBar /> : null}
              <div className="workspace__body">
                <AnalysisHistory />
                <div className="workspace__main">
                  <GenerativeCanvas showRuntimeDiagnostics={diagnosticsEnabled} />
                  <PromptComposer />
                </div>
              </div>
            </main>
          </AgentSessionProvider>
        )}
      </SessionAccessGate>
    </WorkspaceErrorBoundary>
  );
}
