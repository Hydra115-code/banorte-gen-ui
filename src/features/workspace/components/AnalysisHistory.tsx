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

  if (analysisHistory.length === 0) return null;

  return (
    <aside className="analysis-history" aria-label="Historial de análisis">
      <div className="analysis-history__header">
        <h2>Consultas</h2>
        <span>{analysisHistory.length}</span>
      </div>
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
                  <small>{isActive ? "Resultado actual" : formatHistoryTime(item.updatedAt)}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
