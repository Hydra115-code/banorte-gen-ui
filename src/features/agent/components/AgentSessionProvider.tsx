"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import {
  agentDataPartSchemas,
  type AgentPerformance,
  type AgentRuntimeDiagnostics,
  type AgentUIMessage,
} from "../contracts/agent-message";
import type { DataRegistryValue } from "../../generative-ui/data-binding/schemas/data-registry-schema";
import type { UISpecification } from "../../generative-ui/schemas/ui-specification";
import {
  applyUIPatch,
  createUIPatchState,
  type UIPatchState,
} from "../../generative-ui/patches/ui-patch-engine";
import { useWorkspaceStore } from "../../workspace/state/workspace-store";
import type { LocalUIEvent } from "../../generative-ui/interactions/events/local-ui-event";
import { agentUIIntentSchema, type AgentUIIntent } from "../contracts/agent-ui-intent";
import {
  applyDataRegistryPatch,
  createDataRegistryPatchState,
  type DataRegistryPatchState,
} from "../../generative-ui/data-binding/registry/data-registry-patch-engine";
import {
  presentAgentFailure,
  type AgentFailurePresentation,
} from "../recovery/agent-error-presentation";
import {
  loadSessionArchive,
  saveSessionArchive,
  type PersistedAnalysisSnapshot,
} from "../session/session-snapshot-storage";
import {
  appendChange,
  describeUIPatch,
  summarizeSpecificationChange,
  type UIChangeSummary,
} from "../../generative-ui/patches/ui-change-summary";
import {
  captureGeneratedUIFocus,
  restoreGeneratedUIFocusAfterCommit,
} from "../../generative-ui/interactions/reconciliation/focus-reconciliation";
import { classifyInteractionEvent } from "../interactions/interaction-policy";
import { InteractionRequestRegistry } from "../interactions/interaction-request-registry";
import { FrameCommitBatcher } from "../performance/frame-commit-batcher";
import {
  FrontendPerformanceSampler,
  type FrontendPerformanceSummary,
} from "../performance/frontend-performance-sampler";

interface GeneratedInterface {
  specification: UISpecification | null;
  data?: DataRegistryValue;
  revision: number;
  updatedAt: number;
  degradationReason?: "generation_interrupted" | "partial_data";
}

export interface AnalysisHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
}

interface AnalysisSnapshot extends AnalysisHistoryItem {
  answer: string;
  changeSummary?: UIChangeSummary;
  correlationId?: string;
  dataState: DataRegistryPatchState;
  generatedInterface: GeneratedInterface;
  messages: AgentUIMessage[];
  patchState: UIPatchState;
  performance?: AgentPerformance;
  runtimeDiagnostics?: AgentSessionValue["runtimeDiagnostics"];
}

interface AgentSessionValue {
  activeAnalysisId?: string;
  activityMessage: string;
  analysisHistory: readonly AnalysisHistoryItem[];
  answer: string;
  canRetry: boolean;
  changeSummary?: UIChangeSummary;
  correlationId?: string;
  failure?: AgentFailurePresentation;
  frontendPerformance?: FrontendPerformanceSummary;
  generatedInterface?: GeneratedInterface;
  cancel: () => void;
  continueWithPartialData: () => void;
  handleUIEvent: (event: LocalUIEvent) => void;
  pendingNodeIds: ReadonlySet<string>;
  performance?: AgentPerformance;
  retryLastRequest: () => void;
  selectAnalysis: (id: string) => void;
  runtimeDiagnostics?: AgentRuntimeDiagnostics & { frontendTimeToFirstUsefulUiMs?: number };
  sendPrompt: (prompt: string) => Promise<void>;
  sessionTitle?: string;
  startNewSession: () => void;
}

const AgentSessionContext = createContext<AgentSessionValue | null>(null);
const MAX_ANALYSIS_HISTORY = 8;
const transport = new DefaultChatTransport<AgentUIMessage>({
  api: "/api/agent",
  prepareSendMessagesRequest: ({ messages, body }) => {
    if (body?.uiEvent) return { body: { ...body, uiEvent: body.uiEvent } };
    const latestUserMessage = messages.findLast((message) => message.role === "user");
    return {
      body: {
        ...body,
        messages: latestUserMessage ? [latestUserMessage] : [],
      },
    };
  },
});

function createSessionTitle(prompt: string) {
  const normalized = prompt.trim().replace(/[.?!]+$/u, "");
  const firstQuestion = /^(.{1,96}?[?!.])(?:\s|$)/u.exec(prompt.trim())?.[1];
  const title = firstQuestion ?? normalized;
  return title.length <= 72 ? title : `${title.slice(0, 69).trimEnd()}…`;
}

function messagesFromRestoredAnswer(snapshot: PersistedAnalysisSnapshot): AgentUIMessage[] {
  if (!snapshot.answer) return [];
  return [{
    id: `restored-${snapshot.id}`,
    role: "assistant",
    parts: [{ type: "text", text: snapshot.answer }],
  }];
}

function restoreAnalysisSnapshot(snapshot: PersistedAnalysisSnapshot): AnalysisSnapshot | null {
  const patchState = createUIPatchState(snapshot.specification, snapshot.interfaceRevision);
  if (!patchState.success) return null;

  try {
    const baseDataState = createDataRegistryPatchState(snapshot.data, snapshot.dataRevision);
    const dataState: DataRegistryPatchState = {
      ...baseDataState,
      invalidatedKeys: new Set(snapshot.invalidatedKeys),
    };
    return {
      id: snapshot.id,
      title: snapshot.title,
      updatedAt: snapshot.updatedAt,
      answer: snapshot.answer,
      changeSummary: snapshot.changeSummary,
      dataState,
      generatedInterface: {
        specification: patchState.state.specification,
        data: dataState.data,
        revision: patchState.state.revision,
        updatedAt: snapshot.updatedAt,
        ...(snapshot.degradationReason ? { degradationReason: snapshot.degradationReason } : {}),
      },
      messages: messagesFromRestoredAnswer(snapshot),
      patchState: patchState.state,
    };
  } catch {
    return null;
  }
}

function failureScopeFromCode(code: string): "conversation" | "ui" | "data_registry" | "payment" {
  if (code.startsWith("ui_")) return "ui";
  if (code.startsWith("data_")) return "data_registry";
  if (code.startsWith("payment_") || code.startsWith("action_")) return "payment";
  return "conversation";
}

export function AgentSessionProvider({ children }: { children: ReactNode }) {
  const dispatchExperience = useWorkspaceStore((state) => state.dispatchExperience);
  const setError = useWorkspaceStore((state) => state.setError);
  const [generatedInterface, setGeneratedInterface] = useState<GeneratedInterface>();
  const patchStateRef = useRef<UIPatchState | undefined>(undefined);
  const dataStateRef = useRef<DataRegistryPatchState>(createDataRegistryPatchState());
  const sessionIdRef = useRef<string | undefined>(undefined);
  const lastPromptRef = useRef<string | undefined>(undefined);
  const renderStartedAtRef = useRef<number | undefined>(undefined);
  const frontendRenderLatencyRef = useRef<number | undefined>(undefined);
  const clientRequestStartedAtRef = useRef<number | undefined>(undefined);
  const frontendTimeToFirstUsefulUiRef = useRef<number | undefined>(undefined);
  const isInteractionRequestRef = useRef(false);
  const isFollowUpRequestRef = useRef(false);
  const pendingChangesRef = useRef<string[]>([]);
  const interactionRegistryRef = useRef(new InteractionRequestRegistry());
  const lastInteractionIntentRef = useRef<AgentUIIntent | undefined>(undefined);
  const lastRequestKindRef = useRef<"prompt" | "interaction">("prompt");
  const hasAttemptedHydrationRef = useRef(false);
  const frameBatcherRef = useRef<FrameCommitBatcher<GeneratedInterface> | null>(null);
  const performanceSamplerRef = useRef(new FrontendPerformanceSampler());
  const pendingPatchPaintStartsRef = useRef<number[]>([]);
  const [pendingNodeIds, setPendingNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [performance, setPerformance] = useState<AgentPerformance>();
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<AgentSessionValue["runtimeDiagnostics"]>();
  const [correlationId, setCorrelationId] = useState<string>();
  const [canRetry, setCanRetry] = useState(false);
  const [changeSummary, setChangeSummary] = useState<UIChangeSummary>();
  const [failure, setFailure] = useState<AgentFailurePresentation>();
  const [frontendPerformance, setFrontendPerformance] = useState<FrontendPerformanceSummary>();
  const [activityMessage, setActivityMessage] = useState("Listo para analizar tus finanzas");
  const [sessionTitle, setSessionTitle] = useState<string>();
  const [activeAnalysisId, setActiveAnalysisId] = useState<string>();
  const [analysisSnapshots, setAnalysisSnapshots] = useState<AnalysisSnapshot[]>([]);

  const updateGeneratedInterface = setGeneratedInterface;

  const discardBatchedCommit = useCallback(() => {
    frameBatcherRef.current?.discard();
    pendingPatchPaintStartsRef.current = [];
  }, []);

  const scheduleCurrentInterface = useCallback((patchReceivedAt?: number) => {
    const patchState = patchStateRef.current;
    if (!patchState) return;
    if (patchReceivedAt !== undefined) pendingPatchPaintStartsRef.current.push(patchReceivedAt);
    frameBatcherRef.current ??= new FrameCommitBatcher((value) => {
      startTransition(() => updateGeneratedInterface(value));
    });
    frameBatcherRef.current.enqueue({
      specification: patchState.specification,
      data: dataStateRef.current.data,
      revision: patchState.revision,
      updatedAt: Date.now(),
    });
  }, [updateGeneratedInterface]);

  const recordPendingChange = useCallback((change: string) => {
    pendingChangesRef.current = appendChange(pendingChangesRef.current, change);
  }, []);

  const commitPendingChanges = useCallback((revision: number) => {
    const items = pendingChangesRef.current;
    pendingChangesRef.current = [];
    isFollowUpRequestRef.current = false;
    if (items.length > 0) {
      setChangeSummary({ items, revision, updatedAt: Date.now() });
    }
  }, []);

  const preserveForDegradation = useCallback((reason: "generation_interrupted" | "partial_data") => {
    updateGeneratedInterface((current) => {
      if (current) return { ...current, degradationReason: reason };
      return Object.keys(dataStateRef.current.data).length > 0
        ? { specification: null, data: dataStateRef.current.data, revision: 0, updatedAt: Date.now(), degradationReason: reason }
        : current;
    });
  }, [updateGeneratedInterface]);

  const failGracefully = useCallback((
    message: string,
    recoverable = true,
    code = "agent_error",
    hasPartialData?: boolean,
    scope: "conversation" | "ui" | "data_registry" | "payment" = "conversation",
  ) => {
    discardBatchedCommit();
    const hasUsablePartialData = hasPartialData === true
      || Boolean(patchStateRef.current)
      || Object.keys(dataStateRef.current.data).length > 0;
    setPendingNodeIds(new Set());
    isInteractionRequestRef.current = false;
    isFollowUpRequestRef.current = false;
    pendingChangesRef.current = [];
    interactionRegistryRef.current.clear();
    preserveForDegradation("partial_data");
    setCanRetry(recoverable);
    setFailure(presentAgentFailure({ code, message, recoverable, hasPartialData: hasUsablePartialData }));
    setActivityMessage(hasUsablePartialData ? "Conservamos la información disponible" : "La consulta necesita atención");
    setError(message, scope);
  }, [discardBatchedCommit, preserveForDegradation, setError]);

  const { messages, sendMessage, setMessages, status, stop } = useChat<AgentUIMessage>({
    transport,
    dataPartSchemas: agentDataPartSchemas,
    onData: (part) => {
      if (part.type === "data-trace") {
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-session") {
        const isNewSession = sessionIdRef.current !== part.data.id;
        sessionIdRef.current = part.data.id;
        setActiveAnalysisId(part.data.id);
        setCorrelationId(part.data.correlationId);
        if (isNewSession) {
          patchStateRef.current = undefined;
          dataStateRef.current = createDataRegistryPatchState();
          interactionRegistryRef.current.clear();
        }
      } else if (part.type === "data-interaction") {
        const registry = interactionRegistryRef.current;
        if (!registry.matches(part.data.sourceId, part.data.correlationId)) return;
        if (part.data.status !== "pending") registry.settle(part.data.sourceId, part.data.correlationId);
        setPendingNodeIds((current) => {
          const next = new Set(current);
          if (part.data.status === "pending") next.add(part.data.sourceId);
          else next.delete(part.data.sourceId);
          return next;
        });
        if (part.data.status !== "pending") isInteractionRequestRef.current = false;
      } else if (part.type === "data-dataRequest") {
        setActivityMessage(part.data.label);
        dispatchExperience({ type: "DATA_REQUESTED" });
      } else if (part.type === "data-dataAvailable") {
        dataStateRef.current = createDataRegistryPatchState({
          ...dataStateRef.current.data,
          [part.data.key]: part.data.value,
        }, dataStateRef.current.revision);
        if (isFollowUpRequestRef.current) recordPendingChange("Se incorporaron nuevos datos al análisis.");
        scheduleCurrentInterface();
      } else if (part.type === "data-dataPatch") {
        const result = applyDataRegistryPatch(dataStateRef.current, part.data);
        if (!result.success) {
          failGracefully("Se recibió una actualización de datos fuera de orden.", true, "data_patch_invalid", undefined, "data_registry");
          return;
        }
        dataStateRef.current = result.state;
        if (isFollowUpRequestRef.current) recordPendingChange("Se actualizaron los datos vinculados.");
        scheduleCurrentInterface();
      } else if (part.type === "data-status") {
        setActivityMessage(part.data.message);
        if (part.data.stage === "retrieving_data") dispatchExperience({ type: "DATA_REQUESTED" });
        else if (part.data.stage === "generating_ui") dispatchExperience({ type: "UI_GENERATION_STARTED" });
        else if (part.data.stage === "updating") dispatchExperience({ type: "UI_UPDATE_STARTED" });
        else if (part.data.stage === "ready") {
          if (isFollowUpRequestRef.current) {
            commitPendingChanges(patchStateRef.current?.revision ?? dataStateRef.current.revision);
          }
          dispatchExperience({ type: "UI_COMMITTED" });
        }
      } else if (part.type === "data-ui") {
        discardBatchedCommit();
        const previousSpecification = patchStateRef.current?.specification;
        const focusedControl = captureGeneratedUIFocus();
        const initial = createUIPatchState(part.data.specification);
        if (!initial.success) {
          failGracefully("La interfaz recibida no es válida.", true, "ui_specification_invalid", undefined, "ui");
          return;
        }
        renderStartedAtRef.current ??= globalThis.performance.now();
        patchStateRef.current = initial.state;
        dataStateRef.current = createDataRegistryPatchState(
          { ...dataStateRef.current.data, ...(part.data.data ?? {}) },
          dataStateRef.current.revision,
        );
        updateGeneratedInterface({
          specification: initial.state.specification,
          data: dataStateRef.current.data,
          revision: initial.state.revision,
          updatedAt: Date.now(),
        });
        if (previousSpecification) {
          pendingChangesRef.current = summarizeSpecificationChange(previousSpecification, initial.state.specification);
          commitPendingChanges(initial.state.revision);
        }
        restoreGeneratedUIFocusAfterCommit(focusedControl);
        dispatchExperience({ type: "UI_COMMITTED" });
      } else if (part.type === "data-uiStarted") {
        discardBatchedCommit();
        const previousSpecification = patchStateRef.current?.specification;
        const focusedControl = captureGeneratedUIFocus();
        const initial = createUIPatchState(part.data.specification, part.data.revision);
        if (!initial.success) {
          failGracefully("La interfaz progresiva no es válida.", true, "ui_specification_invalid", undefined, "ui");
          return;
        }
        renderStartedAtRef.current ??= globalThis.performance.now();
        patchStateRef.current = initial.state;
        dataStateRef.current = createDataRegistryPatchState(
          { ...dataStateRef.current.data, ...(part.data.data ?? {}) },
          dataStateRef.current.revision,
        );
        updateGeneratedInterface({
          specification: initial.state.specification,
          data: dataStateRef.current.data,
          revision: initial.state.revision,
          updatedAt: Date.now(),
        });
        if (previousSpecification) {
          pendingChangesRef.current = summarizeSpecificationChange(previousSpecification, initial.state.specification);
        }
        restoreGeneratedUIFocusAfterCommit(focusedControl);
        dispatchExperience({ type: "UI_GENERATION_STARTED" });
      } else if (part.type === "data-uiPatch") {
        const patchReceivedAt = globalThis.performance.now();
        if (!patchStateRef.current) {
          failGracefully("No hay una interfaz activa para actualizar.", true, "ui_patch_without_root", undefined, "ui");
          return;
        }
        const previousSpecification = patchStateRef.current.specification;
        const focusedControl = captureGeneratedUIFocus();
        const result = applyUIPatch(patchStateRef.current, part.data);
        if (!result.success) {
          failGracefully("No fue posible aplicar una actualización de interfaz.", true, "ui_patch_invalid", undefined, "ui");
          return;
        }
        performanceSamplerRef.current.recordPatchApply(globalThis.performance.now() - patchReceivedAt);
        patchStateRef.current = result.state;
        recordPendingChange(describeUIPatch(part.data, previousSpecification));
        scheduleCurrentInterface(patchReceivedAt);
        restoreGeneratedUIFocusAfterCommit(focusedControl);
      } else if (part.type === "data-uiCompleted") {
        frameBatcherRef.current?.flush();
        if (patchStateRef.current?.revision !== part.data.revision) {
          dispatchExperience({ type: "REVISION_CONFLICT" });
          dispatchExperience({ type: "PARTIAL_AVAILABLE" });
          setPendingNodeIds(new Set());
          isInteractionRequestRef.current = false;
          preserveForDegradation("partial_data");
          setCanRetry(false);
          setFailure(presentAgentFailure({
            code: "ui_revision_conflict",
            message: "La interfaz terminó con una versión inconsistente.",
            recoverable: true,
            hasPartialData: true,
          }));
          setActivityMessage("Conservamos la última versión válida; falta sincronizar el snapshot vigente");
          return;
        }
        setCanRetry(false);
        setFailure(undefined);
        setActivityMessage(isInteractionRequestRef.current ? "Análisis actualizado" : "Análisis listo");
        commitPendingChanges(part.data.revision);
        dispatchExperience({ type: "UI_COMMITTED" });
      } else if (part.type === "data-performance") {
        setPerformance({
          ...part.data,
          ...(frontendRenderLatencyRef.current === undefined ? {} : { frontendRenderLatencyMs: frontendRenderLatencyRef.current }),
        });
      } else if (part.type === "data-runtimeDiagnostics") {
        setRuntimeDiagnostics({
          ...part.data,
          ...(frontendTimeToFirstUsefulUiRef.current === undefined
            ? {}
            : { frontendTimeToFirstUsefulUiMs: frontendTimeToFirstUsefulUiRef.current }),
        });
      } else if (part.type === "data-agentError") {
        if (part.data.correlationId) setCorrelationId(part.data.correlationId);
        failGracefully(
          part.data.message,
          part.data.recoverable,
          part.data.code,
          part.data.hasPartialData,
          failureScopeFromCode(part.data.code),
        );
      }
    },
    onError: () => {
      failGracefully("No fue posible conectar con el agente.", true, "network_lost");
    },
  });

  useEffect(() => () => frameBatcherRef.current?.discard(), []);

  useEffect(() => {
    if (hasAttemptedHydrationRef.current) return;
    hasAttemptedHydrationRef.current = true;

    const archive = loadSessionArchive(window.sessionStorage);
    if (!archive) return;

    const restoredSnapshots = archive.snapshots
      .map(restoreAnalysisSnapshot)
      .filter((snapshot): snapshot is AnalysisSnapshot => snapshot !== null);
    if (restoredSnapshots.length === 0) return;

    setAnalysisSnapshots(restoredSnapshots);
    if (!archive.activeAnalysisId) return;
    const activeSnapshot = restoredSnapshots.find((snapshot) => snapshot.id === archive.activeAnalysisId);
    if (!activeSnapshot) return;
    sessionIdRef.current = activeSnapshot.id;
    patchStateRef.current = activeSnapshot.patchState;
    dataStateRef.current = activeSnapshot.dataState;
    setActiveAnalysisId(activeSnapshot.id);
    setSessionTitle(activeSnapshot.title);
    setMessages(activeSnapshot.messages);
    updateGeneratedInterface(activeSnapshot.generatedInterface);
    setPendingNodeIds(new Set());
    setCanRetry(false);
    setChangeSummary(activeSnapshot.changeSummary);
    setFailure(undefined);
    setActivityMessage("Análisis restaurado en esta pestaña");
    useWorkspaceStore.setState({ activePrompt: activeSnapshot.title, draft: "", errorMessage: null });
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [dispatchExperience, setMessages, updateGeneratedInterface]);

  useEffect(() => {
    const startedAt = renderStartedAtRef.current;
    if (!generatedInterface) return;
    performanceSamplerRef.current.recordRender();
    const patchStarts = pendingPatchPaintStartsRef.current.splice(0);
    if (startedAt !== undefined) renderStartedAtRef.current = undefined;
    const frame = requestAnimationFrame(() => {
      const paintedAt = globalThis.performance.now();
      patchStarts.forEach((patchStartedAt) => performanceSamplerRef.current.recordPatchToPaint(paintedAt - patchStartedAt));
      setFrontendPerformance(performanceSamplerRef.current.snapshot());
      if (startedAt !== undefined) {
        const frontendRenderLatencyMs = Math.max(0, Math.round((paintedAt - startedAt) * 100) / 100);
        frontendRenderLatencyRef.current = frontendRenderLatencyMs;
        if (frontendTimeToFirstUsefulUiRef.current === undefined && clientRequestStartedAtRef.current !== undefined) {
          frontendTimeToFirstUsefulUiRef.current = Math.max(
            0,
            Math.round((paintedAt - clientRequestStartedAtRef.current) * 100) / 100,
          );
        }
        setPerformance((current) => current ? { ...current, frontendRenderLatencyMs } : current);
        setRuntimeDiagnostics((current) => current && frontendTimeToFirstUsefulUiRef.current !== undefined
          ? { ...current, frontendTimeToFirstUsefulUiMs: frontendTimeToFirstUsefulUiRef.current }
          : current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [generatedInterface]);

  const answer = useMemo(() => {
    const assistantMessage = messages.findLast((message) => message.role === "assistant");
    return assistantMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("") ?? "";
  }, [messages]);

  useEffect(() => {
    const id = activeAnalysisId;
    const title = sessionTitle;
    const patchState = patchStateRef.current;
    if (!id || !title || !generatedInterface || !patchState) return;

    const snapshot: AnalysisSnapshot = {
      id,
      title,
      updatedAt: generatedInterface.updatedAt,
      answer,
      changeSummary,
      correlationId,
      dataState: dataStateRef.current,
      generatedInterface,
      messages,
      patchState,
      performance,
      runtimeDiagnostics,
    };
    setAnalysisSnapshots((current) => [
      snapshot,
      ...current.filter((item) => item.id !== id),
    ].slice(0, MAX_ANALYSIS_HISTORY));
  }, [activeAnalysisId, answer, changeSummary, correlationId, generatedInterface, messages, performance, runtimeDiagnostics, sessionTitle]);

  useEffect(() => {
    if (!hasAttemptedHydrationRef.current || analysisSnapshots.length === 0) return;
    saveSessionArchive(window.sessionStorage, {
      version: "1",
      savedAt: Date.now(),
      ...(activeAnalysisId ? { activeAnalysisId } : {}),
      snapshots: analysisSnapshots.map((snapshot) => ({
        id: snapshot.id,
        title: snapshot.title,
        updatedAt: snapshot.updatedAt,
        answer: snapshot.answer,
        specification: snapshot.patchState.specification,
        data: snapshot.dataState.data,
        interfaceRevision: snapshot.patchState.revision,
        dataRevision: snapshot.dataState.revision,
        invalidatedKeys: [...snapshot.dataState.invalidatedKeys],
        ...(snapshot.changeSummary ? {
          changeSummary: { ...snapshot.changeSummary, items: [...snapshot.changeSummary.items] },
        } : {}),
        ...(snapshot.generatedInterface.degradationReason
          ? { degradationReason: snapshot.generatedInterface.degradationReason }
          : {}),
      })),
    });
  }, [activeAnalysisId, analysisSnapshots]);

  const sendPrompt = useCallback(async (prompt: string) => {
    const submittedPrompt = useWorkspaceStore.getState().submitPrompt(prompt);
    if (!submittedPrompt) return;
    prompt = submittedPrompt;
    lastRequestKindRef.current = "prompt";
    lastPromptRef.current = prompt;
    interactionRegistryRef.current.clear();
    isInteractionRequestRef.current = false;
    setCanRetry(false);
    setFailure(undefined);
    setPendingNodeIds(new Set());
    setPerformance(undefined);
    setRuntimeDiagnostics(undefined);
    setFrontendPerformance(undefined);
    performanceSamplerRef.current.reset();
    discardBatchedCommit();
    setCorrelationId(undefined);
    frontendRenderLatencyRef.current = undefined;
    frontendTimeToFirstUsefulUiRef.current = undefined;
    clientRequestStartedAtRef.current = globalThis.performance.now();
    const submittedAt = Date.now();
    const sessionId = sessionIdRef.current;
    const patchState = patchStateRef.current;
    if (sessionId && patchState) {
      isFollowUpRequestRef.current = true;
      pendingChangesRef.current = [];
      setChangeSummary(undefined);
      setActivityMessage("Actualizando este análisis");
      await sendMessage({ text: prompt }, {
        body: {
          submittedAt,
          sessionId,
          sessionState: {
            interfaceRevision: patchState.revision,
            dataRevision: dataStateRef.current.revision,
            dataKeys: Object.keys(dataStateRef.current.data),
          },
        },
      });
      return;
    }

    sessionIdRef.current = undefined;
    isFollowUpRequestRef.current = false;
    pendingChangesRef.current = [];
    setChangeSummary(undefined);
    setActiveAnalysisId(undefined);
    setSessionTitle(createSessionTitle(prompt));
    setActivityMessage("Interpretando tu consulta financiera");
    renderStartedAtRef.current = undefined;
    frontendRenderLatencyRef.current = undefined;
    patchStateRef.current = undefined;
    dataStateRef.current = createDataRegistryPatchState();
    updateGeneratedInterface(undefined);
    await sendMessage({ text: prompt }, { body: { submittedAt } });
  }, [discardBatchedCommit, sendMessage, updateGeneratedInterface]);

  const startNewSession = useCallback(() => {
    void stop();
    sessionIdRef.current = undefined;
    lastPromptRef.current = undefined;
    isInteractionRequestRef.current = false;
    isFollowUpRequestRef.current = false;
    pendingChangesRef.current = [];
    interactionRegistryRef.current.clear();
    lastInteractionIntentRef.current = undefined;
    lastRequestKindRef.current = "prompt";
    clientRequestStartedAtRef.current = undefined;
    frontendTimeToFirstUsefulUiRef.current = undefined;
    frontendRenderLatencyRef.current = undefined;
    patchStateRef.current = undefined;
    dataStateRef.current = createDataRegistryPatchState();
    setPendingNodeIds(new Set());
    setPerformance(undefined);
    setRuntimeDiagnostics(undefined);
    setFrontendPerformance(undefined);
    performanceSamplerRef.current.reset();
    discardBatchedCommit();
    setCorrelationId(undefined);
    setCanRetry(false);
    setChangeSummary(undefined);
    setFailure(undefined);
    setActivityMessage("Listo para analizar tus finanzas");
    setActiveAnalysisId(undefined);
    setSessionTitle(undefined);
    setMessages([]);
    updateGeneratedInterface(undefined);
  }, [discardBatchedCommit, setMessages, stop, updateGeneratedInterface]);

  const selectAnalysis = useCallback((id: string) => {
    const snapshot = analysisSnapshots.find((item) => item.id === id);
    if (!snapshot || id === activeAnalysisId) return;

    void stop();
    discardBatchedCommit();
    sessionIdRef.current = snapshot.id;
    patchStateRef.current = snapshot.patchState;
    dataStateRef.current = snapshot.dataState;
    isInteractionRequestRef.current = false;
    interactionRegistryRef.current.clear();
    setActiveAnalysisId(snapshot.id);
    setSessionTitle(snapshot.title);
    setMessages(snapshot.messages);
    updateGeneratedInterface(snapshot.generatedInterface);
    setPerformance(snapshot.performance);
    setRuntimeDiagnostics(snapshot.runtimeDiagnostics);
    setCorrelationId(snapshot.correlationId);
    setPendingNodeIds(new Set());
    setCanRetry(false);
    setChangeSummary(snapshot.changeSummary);
    setFailure(undefined);
    setActivityMessage("Análisis restaurado");
    useWorkspaceStore.setState({ activePrompt: snapshot.title, draft: "", errorMessage: null });
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [activeAnalysisId, analysisSnapshots, discardBatchedCommit, dispatchExperience, setMessages, stop, updateGeneratedInterface]);

  const dispatchAgentInteraction = useCallback((intent: AgentUIIntent) => {
    if (!interactionRegistryRef.current.begin(intent)) return false;
    lastInteractionIntentRef.current = intent;
    lastRequestKindRef.current = "interaction";
    isInteractionRequestRef.current = true;
    isFollowUpRequestRef.current = true;
    pendingChangesRef.current = [];
    clientRequestStartedAtRef.current = globalThis.performance.now();
    frontendTimeToFirstUsefulUiRef.current = undefined;
    setCanRetry(false);
    setChangeSummary(undefined);
    setFailure(undefined);
    setActivityMessage("Actualizando este análisis");
    setPendingNodeIds((current) => new Set(current).add(intent.event.sourceId));
    dispatchExperience({ type: "UI_UPDATE_STARTED" });
    void sendMessage(undefined, { body: { submittedAt: Date.now(), uiEvent: intent } });
    return true;
  }, [dispatchExperience, sendMessage]);

  const handleUIEvent = useCallback((event: LocalUIEvent) => {
    const policy = classifyInteractionEvent(event.name);
    if (policy.delivery === "local") {
      setActivityMessage("Cambio visual aplicado localmente");
      return;
    }
    if (policy.delivery === "blocked") {
      const message = "Esta acción financiera requiere confirmación y ejecución autoritativas del backend; no se enviará desde la UI generada.";
      setFailure(presentAgentFailure({
        code: "payment_backend_required",
        message,
        recoverable: false,
        hasPartialData: Boolean(patchStateRef.current),
      }));
      setCanRetry(false);
      setActivityMessage("Acción financiera protegida");
      return;
    }

    const sessionId = sessionIdRef.current;
    const patchState = patchStateRef.current;
    if (
      !event.isValid
      || !sessionId
      || !patchState
      || status !== "ready"
      || interactionRegistryRef.current.isPending(event.sourceId)
    ) {
      return;
    }

    const intent = agentUIIntentSchema.safeParse({
      version: "1",
      correlationId: crypto.randomUUID(),
      sessionId,
      interfaceRevision: patchState.revision,
      dataRevision: dataStateRef.current.revision,
      dataKeys: Object.keys(dataStateRef.current.data),
      currentSpecification: patchState.specification,
      event: event.value === undefined
        ? { name: event.name, sourceId: event.sourceId }
        : { name: event.name, sourceId: event.sourceId, value: event.value },
    });
    if (!intent.success) {
      setError("La interacción no cumple el contrato esperado.", "ui");
      return;
    }
    dispatchAgentInteraction(intent.data);
  }, [dispatchAgentInteraction, setError, status]);

  const cancel = useCallback(() => {
    void stop();
    discardBatchedCommit();
    setPendingNodeIds(new Set());
    isInteractionRequestRef.current = false;
    isFollowUpRequestRef.current = false;
    pendingChangesRef.current = [];
    interactionRegistryRef.current.clear();
    preserveForDegradation("generation_interrupted");
    setCanRetry(true);
    setActivityMessage(generatedInterface ? "Actualización cancelada; conservamos el último resultado" : "Consulta cancelada");
    dispatchExperience({ type: "CANCEL", scope: "generation" });
  }, [discardBatchedCommit, dispatchExperience, generatedInterface, preserveForDegradation, stop]);

  const retryLastRequest = useCallback(() => {
    if (status === "submitted" || status === "streaming") return;
    if (lastRequestKindRef.current === "interaction") {
      const intent = lastInteractionIntentRef.current;
      if (!intent) return;
      dispatchAgentInteraction(intent);
      return;
    }
    const prompt = lastPromptRef.current;
    if (!prompt) return;
    setCanRetry(false);
    void sendPrompt(prompt);
  }, [dispatchAgentInteraction, sendPrompt, status]);

  const continueWithPartialData = useCallback(() => {
    if (!failure?.canContinue || !generatedInterface) return;
    setFailure(undefined);
    setCanRetry(false);
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [dispatchExperience, failure?.canContinue, generatedInterface]);

  const value = useMemo<AgentSessionValue>(() => ({
    activeAnalysisId,
    activityMessage,
    analysisHistory: analysisSnapshots.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
    answer,
    canRetry,
    changeSummary,
    correlationId,
    failure,
    frontendPerformance,
    generatedInterface,
    cancel,
    continueWithPartialData,
    handleUIEvent,
    pendingNodeIds,
    performance,
    retryLastRequest,
    selectAnalysis,
    runtimeDiagnostics,
    sendPrompt,
    sessionTitle,
    startNewSession,
  }), [activeAnalysisId, activityMessage, analysisSnapshots, answer, canRetry, cancel, changeSummary, continueWithPartialData, correlationId, failure, frontendPerformance, generatedInterface, handleUIEvent, pendingNodeIds, performance, retryLastRequest, runtimeDiagnostics, selectAnalysis, sendPrompt, sessionTitle, startNewSession]);

  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

export function useAgentSession() {
  const value = useContext(AgentSessionContext);
  if (!value) throw new Error("useAgentSession requiere AgentSessionProvider");
  return value;
}
