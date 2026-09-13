"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy, type WorkspaceStatus } from "../types/workspace-status";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { UIRenderer } from "../../generative-ui/renderer/UIRenderer";
import { UIEventProvider } from "../../generative-ui/interactions/events/UIEventProvider";
import { isGuidanceOnly } from "../presentation/is-guidance-only";

interface StatusContent {
  detail: string;
  label: string;
  title: string;
}

const statusContent: Record<WorkspaceStatus, StatusContent> = {
  empty: {
    label: "Listo para comenzar",
    title: "Entiende qué cambia en tu dinero",
    detail: "Consulta tus cuentas, compara periodos y descubre qué movimientos explican tus gastos.",
  },
  submitting: {
    label: "Analizando",
    title: "Entendiendo tu consulta",
    detail: "Estamos enviando la consulta y determinando qué información necesita.",
  },
  retrieving_data: {
    label: "Consultando datos",
    title: "Reuniendo la información necesaria",
    detail: "Solo se consultarán las fuentes relevantes para tu petición.",
  },
  generating_ui: {
    label: "Preparando la vista",
    title: "Preparando la vista",
    detail: "Mostraremos la interfaz cuando el análisis esté listo.",
  },
  ready: {
    label: "Actualizado",
    title: "Interfaz preparada",
    detail: "El contenido generado se mostrará aquí.",
  },
  updating: {
    label: "Preparando cambios",
    title: "Preparando la vista",
    detail: "La última vista válida sigue disponible mientras aplicamos el cambio.",
  },
  awaiting_confirmation: {
    label: "Requiere confirmación",
    title: "Revisa y confirma la operación",
    detail: "No se ejecutará ningún pago sin tu confirmación explícita.",
  },
  executing_action: {
    label: "Procesando operación",
    title: "Ejecutando la operación confirmada",
    detail: "Conservaremos la interfaz visible mientras termina el proceso.",
  },
  partial: {
    label: "Resultado parcial",
    title: "Mostrando la información disponible",
    detail: "La última interfaz válida permanece disponible mientras decides cómo continuar.",
  },
  cancelled: {
    label: "Cancelado",
    title: "Consulta cancelada",
    detail: "Puedes ajustar tu pregunta o iniciar una nueva consulta.",
  },
  error: {
    label: "Necesita atención",
    title: "No pudimos completar la consulta",
    detail: "Puedes iniciar una nueva consulta e intentarlo otra vez.",
  },
};

const suggestedPrompts = [
  "¿Por qué ahorré menos este mes aunque gané lo mismo?",
  "Compara mis gastos de julio y agosto",
  "Muéstrame los movimientos que más cambiaron mis gastos",
] as const;

const processSteps = ["Comprendiendo", "Consultando", "Construyendo"] as const;

function getActiveProcessStep(status: WorkspaceStatus) {
  if (status === "retrieving_data") return 1;
  if (status === "generating_ui" || status === "updating") return 2;
  return 0;
}

const processProgress = [18, 58, 88] as const;

function elapsedMilliseconds(start: number | undefined, end: number | undefined) {
  return start === undefined || end === undefined ? undefined : Math.max(0, end - start);
}

function formatPayloadSize(bytes: number) {
  return bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024).toFixed(1)} KB`;
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function GenerativeCanvas({ showRuntimeDiagnostics = false, onShowChat }: { showRuntimeDiagnostics?: boolean; onShowChat?: () => void }) {
  const runtimeRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const previousRevisionRef = useRef<number | undefined>(undefined);
  const status = useWorkspaceStore((state) => state.experience.status);
  const activePrompt = useWorkspaceStore((state) => state.activePrompt);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const {
    activityMessage,
    activeAnalysisId,
    canRetry,
    changeSummary,
    correlationId,
    continueWithPartialData,
    failure,
    frontendPerformance,
    displayedInterface: generatedInterface,
    handleUIEvent,
    isHistoricalView,
    pendingNodeIds,
    performance,
    retryLastRequest,
    recoverSnapshot,
    isRecoveringSnapshot,
    runtimeDiagnostics,
    sessionTitle,
  } = useAgentSession();
  const content = statusContent[status];
  const isSettled = !isWorkspaceBusy(status);
  const isProcessing = !isSettled;
  const isPreviousResult = isProcessing || status === "error" || status === "cancelled" || status === "partial";
  const activeProcessStep = getActiveProcessStep(status);
  const hasFinancialData = Object.keys(generatedInterface?.data ?? {}).length > 0;
  const guidanceOnly = status === "ready" && !failure && !errorMessage
    && isGuidanceOnly(generatedInterface?.specification, hasFinancialData);

  useEffect(() => {
    if (!failure) return;
    requestAnimationFrame(() => failureRef.current?.focus({ preventScroll: true }));
  }, [failure]);

  useEffect(() => {
    const revision = generatedInterface?.revision;
    const previousRevision = previousRevisionRef.current;
    previousRevisionRef.current = revision;
    if (revision === undefined || previousRevision === undefined || revision === previousRevision) return;

    const runtime = runtimeRef.current;
    if (!runtime) return;
    const distanceFromBottom = runtime.scrollHeight - runtime.scrollTop - runtime.clientHeight;
    if (distanceFromBottom > 120) return;

    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => runtime.scrollTo({
      behavior: reducedMotion ? "auto" : "smooth",
      top: runtime.scrollHeight,
    }));
  }, [generatedInterface?.revision]);

  return (
    <section className="canvas" aria-labelledby="canvas-title" data-has-result={Boolean(generatedInterface && !guidanceOnly)} data-guidance-only={guidanceOnly || undefined}>
      <header className="canvas__header">
        <div>
          <p className="canvas__eyebrow">Área de trabajo</p>
          <h1 id="canvas-title">Banca personal</h1>
        </div>
        <span className="canvas__status" data-status={status}>
          <span aria-hidden="true" />
          {isHistoricalView ? "Revisión anterior" : content.label}
        </span>
      </header>

      <div
        ref={runtimeRef}
        className="canvas__runtime"
        data-status={status}
        aria-busy={!isSettled}
      >
        <p className="sr-only" role="status">{isHistoricalView ? "Revisión anterior de solo lectura" : isProcessing ? activityMessage : content.title}</p>
        {guidanceOnly ? (
          <div className="canvas-guidance">
            <p className="canvas-result__overline">Respuesta en la conversación</p>
            <h2>Construyamos una vista con tus datos</h2>
            <p>Esta petición no produjo un análisis visual. Puedes pedir saldos, movimientos, comparaciones o un cambio concreto en una interfaz existente.</p>
            <div className="canvas-guidance__actions">
              {suggestedPrompts.slice(0, 2).map((prompt) => (
                <button key={prompt} type="button" onClick={() => { setDraft(prompt); onShowChat?.(); }}>{prompt}</button>
              ))}
            </div>
          </div>
        ) : generatedInterface ? (
          <div className="canvas-result">
            <header className="canvas-result__header">
              <div>
                <p className="canvas-result__overline">Análisis activo</p>
                <h2>{isHistoricalView ? "Revisión anterior" : isPreviousResult ? "Última vista válida disponible" : "Tu análisis financiero"}</h2>
                {(activePrompt ?? sessionTitle) && !isHistoricalView ? (
                  <details className="canvas-result__query">
                    <summary>Ver petición original</summary>
                    <p>{activePrompt ?? sessionTitle}</p>
                  </details>
                ) : null}
              </div>
              <div className="canvas-result__metadata" aria-label="Estado del resultado">
                <span>Actualizado {formatUpdatedAt(generatedInterface.updatedAt)}</span>
                {hasFinancialData ? <span>{isHistoricalView ? "Solo lectura" : isPreviousResult ? "Datos de la vista conservada" : "Datos actualizados"}</span> : null}
              </div>
            </header>
            {isProcessing ? (
              <div className="canvas-result__activity">
                <span className="canvas-result__activity-indicator" aria-hidden="true" />
                <div>
                  <strong>Preparando cambios</strong>
                  <p>{activityMessage}</p>
                </div>
              </div>
            ) : null}
            {failure || errorMessage || status === "partial" || status === "cancelled" ? (
              <div ref={failureRef} className="canvas-result__degradation" data-kind={status === "cancelled" ? "cancelled" : status === "partial" ? "partial" : "error"} role="alert" tabIndex={-1}>
                <div>
                  <strong>{failure?.title ?? "Resultado parcial conservado"}</strong>
                  <p>{failure?.message ?? errorMessage ?? "La consulta fue cancelada antes de completarse."}</p>
                </div>
                <div className="canvas-result__degradation-actions">
                  {failure?.canContinue ? (
                    <button className="canvas-result__degradation-secondary" type="button" onClick={continueWithPartialData}>
                      Continuar con datos parciales
                    </button>
                  ) : null}
                  {(failure?.canRetry ?? canRetry) ? <button type="button" onClick={retryLastRequest}>Reintentar</button> : null}
                  {failure?.code.includes("revision_conflict") ? (
                    <button type="button" disabled={isRecoveringSnapshot} onClick={recoverSnapshot}>
                      {isRecoveringSnapshot ? "Sincronizando…" : "Sincronizar UI y datos"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="canvas-result__surface" inert={isHistoricalView} aria-label={isHistoricalView ? "Interfaz anterior de solo lectura" : undefined}>
              <UIEventProvider key={activeAnalysisId}>
              <UIRenderer
                data={generatedInterface.data}
                degradationReason={generatedInterface.degradationReason}
                onEvent={handleUIEvent}
                pendingNodeIds={pendingNodeIds}
                specification={generatedInterface.specification}
              />
              </UIEventProvider>
            </div>
            {changeSummary && !isProcessing && !isHistoricalView ? (
              <details className="canvas-result__changes">
                <summary>Cómo se adaptó esta vista</summary>
                <ul>
                  {changeSummary.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            ) : null}
            {showRuntimeDiagnostics && (performance || runtimeDiagnostics) ? (
              <details className="canvas-performance">
                <summary>Cómo se obtuvo este resultado</summary>
                <ul className="canvas-performance__evidence">
                  <li>Solicitud interpretada por el agente</li>
                  {hasFinancialData ? <li>Datos financieros consultados mediante MCP</li> : null}
                  <li>{generatedInterface.specification
                    ? "Vista renderizada validada; consulta el estado de la generación actual"
                    : "UI solicitada no disponible; se muestran datos de respaldo"}</li>
                </ul>
                <dl aria-label="Rendimiento de generación">
                  {activeAnalysisId ? <div><dt>Sesión activa</dt><dd>{activeAnalysisId}</dd></div> : null}
                  <div><dt>Revisión UI</dt><dd>{generatedInterface.revision}</dd></div>
                  {performance ? <div><dt>Agente</dt><dd>{performance.agentLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>MCP</dt><dd>{performance.mcpLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Datos</dt><dd>{performance.dataLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Plan UI</dt><dd>{performance.uiPlanningLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Primera UI</dt><dd>{performance.timeToFirstUiMs} ms</dd></div> : null}
                  {runtimeDiagnostics?.frontendTimeToFirstUsefulUiMs === undefined && performance ? (
                    <div><dt>Primera UI útil</dt><dd>{performance.timeToFirstUsefulUiMs} ms</dd></div>
                  ) : null}
                  {runtimeDiagnostics?.frontendTimeToFirstUsefulUiMs === undefined ? null : (
                    <div><dt>Primera UI útil real</dt><dd>{runtimeDiagnostics.frontendTimeToFirstUsefulUiMs} ms</dd></div>
                  )}
                  {performance?.frontendRenderLatencyMs === undefined ? null : (
                    <div><dt>Render</dt><dd>{performance.frontendRenderLatencyMs} ms</dd></div>
                  )}
                  {performance ? <div><dt>Total</dt><dd>{performance.totalGenerationMs} ms</dd></div> : null}
                  {runtimeDiagnostics?.milestones.firstEventAt === undefined ? null : (
                    <div><dt>Primer evento</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.promptSubmittedAt, runtimeDiagnostics.milestones.firstEventAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpResultAt === undefined ? null : (
                    <div><dt>Primeros datos</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.promptSubmittedAt, runtimeDiagnostics.milestones.firstMcpResultAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.agentStartedAt === undefined ? null : (
                    <div><dt>Inicio agente</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.agentStartedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpRequestAt === undefined ? null : (
                    <div><dt>Primera petición MCP</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstMcpRequestAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpResultAt === undefined ? null : (
                    <div><dt>Primer resultado MCP</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstMcpResultAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.uiGenerationStartedAt === undefined ? null : (
                    <div><dt>Inicio generación UI</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.uiGenerationStartedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstUiNodeAt === undefined ? null : (
                    <div><dt>Primer nodo UI</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstUiNodeAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.uiCompletedAt === undefined ? null : (
                    <div><dt>UI completada</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.uiCompletedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics ? <div><dt>Contexto estimado</dt><dd>≈{runtimeDiagnostics.estimatedInputTokens} tokens</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Salida estimada</dt><dd>≈{runtimeDiagnostics.estimatedOutputTokens} tokens</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Request</dt><dd>{formatPayloadSize(runtimeDiagnostics.requestBytes)}</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Stream</dt><dd>{formatPayloadSize(runtimeDiagnostics.streamedPayloadBytes)}</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Eventos / patches</dt><dd>{runtimeDiagnostics.eventCount} / {runtimeDiagnostics.uiPatchCount}</dd></div> : null}
                  {frontendPerformance ? <div><dt>Renders frontend</dt><dd>{frontendPerformance.renderCount}</dd></div> : null}
                  {frontendPerformance?.firstFeedbackPaintMs === undefined ? null : <div><dt>Primer feedback pintado</dt><dd>{frontendPerformance.firstFeedbackPaintMs} ms</dd></div>}
                  {frontendPerformance?.patchApplyP50Ms === undefined ? null : <div><dt>Aplicar patch p50</dt><dd>{frontendPerformance.patchApplyP50Ms} ms</dd></div>}
                  {frontendPerformance?.patchApplyP95Ms === undefined ? null : <div><dt>Aplicar patch p95</dt><dd>{frontendPerformance.patchApplyP95Ms} ms</dd></div>}
                  {frontendPerformance?.patchToPaintP50Ms === undefined ? null : <div><dt>Patch a pintura p50</dt><dd>{frontendPerformance.patchToPaintP50Ms} ms</dd></div>}
                  {frontendPerformance?.patchToPaintP95Ms === undefined ? null : <div><dt>Patch a pintura p95</dt><dd>{frontendPerformance.patchToPaintP95Ms} ms</dd></div>}
                  {performance ? <div><dt>Traza</dt><dd title={performance.correlationId}>{performance.correlationId.slice(0, 8)}</dd></div> : null}
                </dl>
              </details>
            ) : showRuntimeDiagnostics && correlationId ? <p className="canvas-trace" title={correlationId}>Traza {correlationId.slice(0, 8)}</p> : null}
          </div>
        ) : isProcessing ? (
          <div className="canvas-process" data-step={activeProcessStep}>
            <div className="canvas-process__signal" aria-hidden="true">
              <span className="canvas-process__orbit canvas-process__orbit--outer" />
              <span className="canvas-process__orbit canvas-process__orbit--inner" />
              <span className="canvas-process__core"><span /></span>
            </div>
            <div className="canvas-process__copy" key={status}>
              <p>{activePrompt}</p>
              <h2>{content.title}</h2>
              <span>{activityMessage}</span>
            </div>
            <div className="canvas-process__progress">
              <div
                className="canvas-process__progress-track"
                role="progressbar"
                aria-label="Progreso de la consulta"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={processProgress[activeProcessStep]}
              >
                <span />
              </div>
              <ol className="canvas-process__steps" aria-label="Etapas de la consulta">
                {processSteps.map((step, index) => (
                  <li key={step} data-state={index === activeProcessStep ? "active" : index < activeProcessStep ? "complete" : "pending"}>
                    <span aria-hidden="true" />
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="canvas-state" data-settled={status !== "empty"}>
            <div className="canvas-state__copy">
              <div className="canvas-state__label">
                Análisis adaptable
              </div>
              {activePrompt ? <p className="canvas-state__prompt">{activePrompt}</p> : null}
              <h2>{failure?.title ?? content.title}</h2>
              <p>{failure?.message ?? errorMessage ?? content.detail}</p>
              {(failure?.canRetry ?? canRetry) && status !== "empty" ? (
                <button className="canvas-state__retry" type="button" onClick={retryLastRequest}>Reintentar</button>
              ) : null}

              {status === "empty" ? (
                <div className="canvas-state__suggestions" aria-label="Ideas de consulta">
                  {suggestedPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setDraft(prompt)}>
                      <span>{prompt}</span>
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4 10h11M11 6l4 4-4 4" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
