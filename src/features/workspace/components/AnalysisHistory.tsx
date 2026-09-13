"use client";

import { useAgentSession } from "../../agent/components/AgentSessionProvider";

function formatHistoryTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function AnalysisHistory() {
  const { activeAnalysisId, analysisHistory, selectAnalysis } = useAgentSession();

  if (analysisHistory.length <= 1) return null;

  return (
    <details className="analysis-history">
      <summary>Consultas anteriores <span>{analysisHistory.length}</span></summary>
      <nav aria-label="Resultados anteriores">
        <ol>
          {analysisHistory.map((item) => {
            const isActive = item.id === activeAnalysisId;
            return (
              <li key={item.id}>
                <button
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive || undefined}
                  type="button"
                  onClick={() => selectAnalysis(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{isActive ? "Hilo activo" : formatHistoryTime(item.updatedAt)}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </details>
  );
}
