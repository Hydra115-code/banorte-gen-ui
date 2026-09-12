"use client";

import { GenerativeCanvas } from "./GenerativeCanvas";
import { PromptComposer } from "./PromptComposer";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AgentSessionProvider } from "../../agent/components/AgentSessionProvider";
import { SystemStatusBar } from "../../system-status/components/SystemStatusBar";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";
import { AnalysisHistory } from "./AnalysisHistory";

export function AppShell() {
  return (
    <WorkspaceErrorBoundary>
      <AgentSessionProvider>
        <main className="workspace">
          <WorkspaceHeader />
          <SystemStatusBar />
          <div className="workspace__body">
            <AnalysisHistory />
            <div className="workspace__main">
              <GenerativeCanvas />
              <PromptComposer />
            </div>
          </div>
        </main>
      </AgentSessionProvider>
    </WorkspaceErrorBoundary>
  );
}
