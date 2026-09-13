"use client";

import { GenerativeCanvas } from "./GenerativeCanvas";
import { ConversationPanel } from "./ConversationPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AgentSessionProvider } from "../../agent/components/AgentSessionProvider";
import { SystemStatusBar } from "../../system-status/components/SystemStatusBar";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";
import { AnalysisHistory } from "./AnalysisHistory";
import { shouldExposeRuntimeDiagnostics } from "../../../shared/security/runtime-diagnostics-visibility";
import { useState, type ReactNode } from "react";
import { SessionAccessGate } from "@/features/auth/components/SessionAccessGate";

interface AppShellProps {
  diagnostics?: ReactNode;
  showDeveloperDiagnostics?: boolean;
}

export function AppShell({ diagnostics, showDeveloperDiagnostics = false }: AppShellProps = {}) {
  const diagnosticsEnabled = shouldExposeRuntimeDiagnostics(process.env.NODE_ENV, showDeveloperDiagnostics);
  const [mobilePane, setMobilePane] = useState<"conversation" | "result">("conversation");

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
                <div className="workspace__tabs" role="tablist" aria-label="Área de trabajo" onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? "conversation" : event.key === "End" ? "result" : mobilePane === "conversation" ? "result" : "conversation";
                  setMobilePane(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }}>
                  <button type="button" role="tab" id="conversation-tab" aria-controls="conversation-pane" aria-selected={mobilePane === "conversation"} tabIndex={mobilePane === "conversation" ? 0 : -1} onClick={() => setMobilePane("conversation")}>Chat</button>
                  <button type="button" role="tab" id="result-tab" aria-controls="result-pane" aria-selected={mobilePane === "result"} tabIndex={mobilePane === "result" ? 0 : -1} onClick={() => setMobilePane("result")}>Resultado</button>
                </div>
                <div className="workspace__main" data-mobile-pane={mobilePane}>
                  <div className="workspace__pane workspace__pane--conversation" id="conversation-pane" role="tabpanel" aria-labelledby="conversation-tab" tabIndex={0}>
                    <AnalysisHistory />
                    <ConversationPanel onShowResult={() => setMobilePane("result")} />
                  </div>
                  <div className="workspace__pane workspace__pane--result" id="result-pane" role="tabpanel" aria-labelledby="result-tab" tabIndex={0}>
                    <GenerativeCanvas showRuntimeDiagnostics={diagnosticsEnabled} onShowChat={() => setMobilePane("conversation")} />
                  </div>
                </div>
              </div>
            </main>
          </AgentSessionProvider>
        )}
      </SessionAccessGate>
    </WorkspaceErrorBoundary>
  );
}
