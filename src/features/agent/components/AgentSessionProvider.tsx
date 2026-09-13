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
  clearSessionArchive,
  isPersonalBankingAnalysisTitle,
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
import { collectFormValues } from "../interactions/form-submission";
import { InteractionRequestRegistry } from "../interactions/interaction-request-registry";
import { restoreSessionUiSnapshot } from "../session/session-ui-snapshot";
import { FrameCommitBatcher } from "../performance/frame-commit-batcher";
import {
  FrontendPerformanceSampler,
  isUsefulGeneratedInterface,
  type FrontendPerformanceSummary,
} from "../performance/frontend-performance-sampler";
import { isGuidanceOnly } from "../../workspace/presentation/is-guidance-only";

interface GeneratedInterface {
  specification: UISpecification | null;
  data?: DataRegistryValue;
  revision: number;
  updatedAt: number;
  degradationReason?: "generation_interrupted" | "partial_data";
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  revision?: number;
  sources?: readonly string[];
  controls?: readonly string[];
  changes?: readonly string[];
}

interface TurnDetails {
  sources: string[];
  controls: string[];
  changes: string[];
}

function collectControlLabels(specification: UISpecification | null): string[] {
  if (!specification) return [];
  const labels = new Set<string>();
  const pending = [specification.root];
  while (pending.length && labels.size < 8) {
    const node = pending.pop()!;
    if ("event" in node && "label" in node && typeof node.label === "string") labels.add(node.label);
    if ("children" in node) pending.push(...node.children);
    if (node.type === "tabs" || node.type === "accordion") node.items.forEach((item) => pending.push(...item.children));
    else if (node.type === "repeat") {
      pending.push(node.template);
      if (node.empty) pending.push(node.empty);
    } else if (node.type === "conditional") {
      pending.push(node.then);
      if (node.else) pending.push(node.else);
    }
  }
  return [...labels];
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
  turnResults: Record<string, GeneratedInterface>;
  turnDetails: Record<string, TurnDetails>;
  performance?: AgentPerformance;
  runtimeDiagnostics?: AgentSessionValue["runtimeDiagnostics"];
}

interface AgentSessionValue {
  activeAnalysisId?: string;
  activityMessage: string;
  analysisHistory: readonly AnalysisHistoryItem[];
  answer: string;
  conversationTurns: readonly ConversationTurn[];
  focusedTurnId?: string;
  focusTurn: (id: string) => void;
  displayedInterface?: GeneratedInterface;
  isHistoricalView: boolean;
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
  recoverSnapshot: () => void;
  testStaleSimulation: () => void;
  isRecoveringSnapshot: boolean;
  selectAnalysis: (id: string) => void;
  runtimeDiagnostics?: AgentRuntimeDiagnostics & { frontendTimeToFirstUsefulUiMs?: number };
  sendPrompt: (prompt: string) => Promise<void>;
  sessionTitle?: string;
  startNewSession: () => void;
}

const AgentSessionContext = createContext<AgentSessionValue | null>(null);
const MAX_ANALYSIS_HISTORY = 8;
class AgentTransportError extends Error {
  constructor(readonly code: "authentication_required") {
    super("La sesión de acceso ya no está disponible");
    this.name = "AgentTransportError";
  }
}
const transport = new DefaultChatTransport<AgentUIMessage>({
  api: "/api/agent",
  fetch: async (input, init) => {
    const response = await fetch(input, init);
    if (response.status === 401) throw new AgentTransportError("authentication_required");
    return response;
  },
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
      turnResults: snapshot.answer ? { [`restored-${snapshot.id}`]: {
        specification: patchState.state.specification,
        data: dataState.data,
        revision: patchState.state.revision,
        updatedAt: snapshot.updatedAt,
      } } : {},
      turnDetails: {},
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

export function AgentSessionProvider({ children, ownerKey }: { children: ReactNode; ownerKey: string }) {
  const dispatchExperience = useWorkspaceStore((state) => state.dispatchExperience);
  const setError = useWorkspaceStore((state) => state.setError);
  const [generatedInterface, setGeneratedInterface] = useState<GeneratedInterface>();
  const patchStateRef = useRef<UIPatchState | undefined>(undefined);
  const dataStateRef = useRef<DataRegistryPatchState>(createDataRegistryPatchState());
  const synchronizationBlockedRef = useRef(false);
  const conflictedSessionIdsRef = useRef(new Set<string>());
  const recoveryEpochRef = useRef(0);
  const [isRecoveringSnapshot, setIsRecoveringSnapshot] = useState(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const formDraftsRef = useRef(new Map<string, string>());
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
  const [suppressedAnswerId, setSuppressedAnswerId] = useState<string>();
  const [frontendPerformance, setFrontendPerformance] = useState<FrontendPerformanceSummary>();
  const [activityMessage, setActivityMessage] = useState("Listo para analizar tus finanzas");
  const [sessionTitle, setSessionTitle] = useState<string>();
  const [activeAnalysisId, setActiveAnalysisId] = useState<string>();
  const [analysisSnapshots, setAnalysisSnapshots] = useState<AnalysisSnapshot[]>([]);
  const [turnResults, setTurnResults] = useState<Record<string, GeneratedInterface>>({});
  const [turnDetails, setTurnDetails] = useState<Record<string, TurnDetails>>({});
  const requestedSourcesRef = useRef<string[]>([]);
  const [focusedTurnId, setFocusedTurnId] = useState<string>();

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
    if (scope === "ui" || scope === "data_registry") {
      console.warn(`Agent stream validation failed: ${code} (${scope})`);
    }
    if (code.includes("revision_conflict")) {
      synchronizationBlockedRef.current = true;
      if (sessionIdRef.current) conflictedSessionIdsRef.current.add(sessionIdRef.current);
    }
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
    const presentation = presentAgentFailure({ code, message, recoverable, hasPartialData: hasUsablePartialData });
    setCanRetry(presentation.canRetry);
    setFailure(presentation);
    setActivityMessage(hasUsablePartialData ? "Conservamos la información disponible" : "La consulta necesita atención");
    setError(message, scope);
  }, [discardBatchedCommit, preserveForDegradation, setError]);

  const { messages, sendMessage, setMessages, status, stop } = useChat<AgentUIMessage>({
    transport,
    dataPartSchemas: agentDataPartSchemas,
    onData: (part) => {
      if (synchronizationBlockedRef.current && [
        "data-dataAvailable", "data-dataPatch", "data-ui", "data-uiStarted",
        "data-uiPatch", "data-uiCompleted", "data-status",
      ].includes(part.type)) return;
      if (part.type === "data-trace") {
        setCorrelationId(part.data.correlationId);
      } else if (part.type === "data-session") {
        const isNewSession = sessionIdRef.current !== part.data.id;
        sessionIdRef.current = part.data.id;
        setActiveAnalysisId(part.data.id);
        setCorrelationId(part.data.correlationId);
        if (isNewSession) {
          formDraftsRef.current.clear();
          synchronizationBlockedRef.current = false;
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
        if (!requestedSourcesRef.current.includes(part.data.label)) {
          requestedSourcesRef.current = [...requestedSourcesRef.current, part.data.label].slice(0, 8);
        }
        setActivityMessage(part.data.label);
        dispatchExperience({ type: "DATA_REQUESTED" });
      } else if (part.type === "data-dataAvailable") {
        dataStateRef.current = createDataRegistryPatchState({
          ...dataStateRef.current.data,
          [part.data.key]: part.data.value,
        }, dataStateRef.current.revision);
        if (isFollowUpRequestRef.current) recordPendingChange("Se incorporaron nuevos datos al análisis.");
        if (!isFollowUpRequestRef.current) scheduleCurrentInterface();
      } else if (part.type === "data-dataPatch") {
        const result = applyDataRegistryPatch(dataStateRef.current, part.data);
        if (!result.success) {
          failGracefully("Se recibió una actualización de datos fuera de orden.", true,
            result.error.code === "version_conflict" ? "data_revision_conflict" : "data_patch_invalid",
            undefined, "data_registry");
          return;
        }
        dataStateRef.current = result.state;
        if (isFollowUpRequestRef.current) recordPendingChange("Se actualizaron los datos vinculados.");
        if (!isFollowUpRequestRef.current) scheduleCurrentInterface();
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
          failGracefully("No fue posible aplicar una actualización de interfaz.", true,
            result.error.code === "version_conflict" ? "ui_revision_conflict" : "ui_patch_invalid",
            undefined, "ui");
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
          synchronizationBlockedRef.current = true;
          if (sessionIdRef.current) conflictedSessionIdsRef.current.add(sessionIdRef.current);
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
        if (part.data.code === "authentication_required") {
          useWorkspaceStore.setState({ draft: lastPromptRef.current ?? useWorkspaceStore.getState().draft });
          window.dispatchEvent(new Event("banorte:authentication-required"));
        }
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
    onError: (error) => {
      if (error instanceof AgentTransportError) {
        useWorkspaceStore.setState({ draft: lastPromptRef.current ?? useWorkspaceStore.getState().draft });
        window.dispatchEvent(new Event("banorte:authentication-required"));
        failGracefully(error.message, false, error.code);
        return;
      }
      failGracefully("No fue posible conectar con el agente.", true, "network_lost");
    },
  });

  useEffect(() => () => frameBatcherRef.current?.discard(), []);

  useEffect(() => {
    if (hasAttemptedHydrationRef.current) return;
    hasAttemptedHydrationRef.current = true;

    const archive = loadSessionArchive(window.sessionStorage, ownerKey);
    if (!archive) return;

    const restoredSnapshots = archive.snapshots
      .filter((snapshot) => isPersonalBankingAnalysisTitle(snapshot.title))
      .map(restoreAnalysisSnapshot)
      .filter((snapshot): snapshot is AnalysisSnapshot => snapshot !== null);
    if (restoredSnapshots.length === 0) {
      clearSessionArchive(window.sessionStorage);
      return;
    }

    setAnalysisSnapshots(restoredSnapshots);
    const activeSnapshot = restoredSnapshots.find((snapshot) => snapshot.id === archive.activeAnalysisId)
      ?? restoredSnapshots[0];
    if (!activeSnapshot) return;
    sessionIdRef.current = activeSnapshot.id;
    patchStateRef.current = activeSnapshot.patchState;
    dataStateRef.current = activeSnapshot.dataState;
    setActiveAnalysisId(activeSnapshot.id);
    setSessionTitle(activeSnapshot.title);
    setMessages(activeSnapshot.messages);
    setTurnResults(activeSnapshot.turnResults);
    setTurnDetails(activeSnapshot.turnDetails);
    setFocusedTurnId(undefined);
    updateGeneratedInterface(activeSnapshot.generatedInterface);
    setPendingNodeIds(new Set());
    setCanRetry(false);
    setChangeSummary(activeSnapshot.changeSummary);
    setFailure(undefined);
    setActivityMessage("Análisis restaurado en esta pestaña");
    useWorkspaceStore.setState({
      activePrompt: activeSnapshot.title,
      draft: useWorkspaceStore.getState().draft,
      errorMessage: null,
    });
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [dispatchExperience, ownerKey, setMessages, updateGeneratedInterface]);

  useEffect(() => {
    const startedAt = renderStartedAtRef.current;
    if (!generatedInterface) return;
    const isUsefulInterface = isUsefulGeneratedInterface(generatedInterface.specification);
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
        if (isUsefulInterface && frontendTimeToFirstUsefulUiRef.current === undefined && clientRequestStartedAtRef.current !== undefined) {
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
    if (assistantMessage?.id === suppressedAnswerId) return "";
    return assistantMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("") ?? "";
  }, [messages, suppressedAnswerId]);

  const conversationTurns = useMemo<ConversationTurn[]>(() => messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const result = turnResults[message.id];
      const hasFinancialData = Object.keys(result?.data ?? {}).length > 0;
      return {
        id: message.id,
        role: message.role as "user" | "assistant",
        text: message.parts.filter((part) => part.type === "text").map((part) => part.text).join("").trim(),
        ...(result && !isGuidanceOnly(result.specification, hasFinancialData) ? { revision: result.revision } : {}),
        ...(turnDetails[message.id] ?? {}),
      };
    })
    .filter((turn) => turn.text.length > 0 || turn.revision !== undefined), [messages, turnResults, turnDetails]);

  useEffect(() => {
    if (!generatedInterface || status !== "ready") return;
    const assistantIndex = messages.findLastIndex((message) => message.role === "assistant");
    if (assistantIndex < messages.findLastIndex((message) => message.role === "user")) return;
    const assistantId = messages[assistantIndex]?.id;
    if (!assistantId) return;
    setTurnResults((current) => {
      if (current[assistantId]?.updatedAt === generatedInterface.updatedAt) return current;
      const entries = Object.entries({ ...current, [assistantId]: generatedInterface }).slice(-24);
      return Object.fromEntries(entries);
    });
    const details: TurnDetails = {
      sources: requestedSourcesRef.current,
      controls: collectControlLabels(generatedInterface.specification),
      changes: [...(changeSummary?.items ?? [])],
    };
    setTurnDetails((current) => JSON.stringify(current[assistantId]) === JSON.stringify(details)
      ? current
      : Object.fromEntries(Object.entries({ ...current, [assistantId]: details }).slice(-24)));
  }, [changeSummary, generatedInterface, messages, status]);

  const focusTurn = useCallback((id: string) => {
    if (!turnResults[id]) return;
    setFocusedTurnId(id);
  }, [turnResults]);
  const latestAssistantId = messages.findLast((message) => message.role === "assistant")?.id;
  const isHistoricalView = Boolean(focusedTurnId && focusedTurnId !== latestAssistantId && turnResults[focusedTurnId]);
  const displayedInterface = isHistoricalView && focusedTurnId ? turnResults[focusedTurnId] : generatedInterface;

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
      turnResults,
      turnDetails,
      performance,
      runtimeDiagnostics,
    };
    setAnalysisSnapshots((current) => [
      snapshot,
      ...current.filter((item) => item.id !== id),
    ].slice(0, MAX_ANALYSIS_HISTORY));
  }, [activeAnalysisId, answer, changeSummary, correlationId, generatedInterface, messages, performance, runtimeDiagnostics, sessionTitle, turnResults, turnDetails]);

  useEffect(() => {
    if (!hasAttemptedHydrationRef.current || analysisSnapshots.length === 0) return;
    saveSessionArchive(window.sessionStorage, {
      version: "1",
      ownerKey,
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
  }, [activeAnalysisId, analysisSnapshots, ownerKey]);

  const sendPrompt = useCallback(async (prompt: string) => {
    if (synchronizationBlockedRef.current) {
      setActivityMessage("Este análisis necesita recuperar el snapshot autoritativo antes de continuar");
      return;
    }
    const requestStartedAt = globalThis.performance.now();
    const submittedPrompt = useWorkspaceStore.getState().submitPrompt(prompt);
    if (!submittedPrompt) return;
    prompt = submittedPrompt;
    setFocusedTurnId(undefined);
    requestedSourcesRef.current = [];
    lastRequestKindRef.current = "prompt";
    lastPromptRef.current = prompt;
    interactionRegistryRef.current.clear();
    isInteractionRequestRef.current = false;
    setCanRetry(false);
    setFailure(undefined);
    setSuppressedAnswerId(messages.findLast((message) => message.role === "assistant")?.id);
    setPendingNodeIds(new Set());
    setPerformance(undefined);
    setRuntimeDiagnostics(undefined);
    setFrontendPerformance(undefined);
    performanceSamplerRef.current.reset();
    discardBatchedCommit();
    setCorrelationId(undefined);
    frontendRenderLatencyRef.current = undefined;
    frontendTimeToFirstUsefulUiRef.current = undefined;
    clientRequestStartedAtRef.current = requestStartedAt;
    // The submitting/updating state is local and does not wait for the API.
    // The second frame is the first opportunity to measure an already painted
    // feedback state, rather than merely the server's first event.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (clientRequestStartedAtRef.current !== requestStartedAt || document.visibilityState !== "visible") return;
      performanceSamplerRef.current.recordFirstFeedbackPaint(globalThis.performance.now() - requestStartedAt);
      setFrontendPerformance(performanceSamplerRef.current.snapshot());
    }));
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
    setTurnResults({});
    setTurnDetails({});
    updateGeneratedInterface(undefined);
    await sendMessage({ text: prompt }, { body: { submittedAt } });
  }, [discardBatchedCommit, messages, sendMessage, updateGeneratedInterface]);

  const startNewSession = useCallback(() => {
    recoveryEpochRef.current += 1;
    setIsRecoveringSnapshot(false);
    synchronizationBlockedRef.current = false;
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
    setSuppressedAnswerId(undefined);
    setActivityMessage("Listo para analizar tus finanzas");
    setActiveAnalysisId(undefined);
    setSessionTitle(undefined);
    setMessages([]);
    setTurnResults({});
    setTurnDetails({});
    setFocusedTurnId(undefined);
    updateGeneratedInterface(undefined);
  }, [discardBatchedCommit, setMessages, stop, updateGeneratedInterface]);

  const selectAnalysis = useCallback((id: string) => {
    const snapshot = analysisSnapshots.find((item) => item.id === id);
    if (!snapshot || id === activeAnalysisId) return;
    recoveryEpochRef.current += 1;
    setIsRecoveringSnapshot(false);

    void stop();
    discardBatchedCommit();
    sessionIdRef.current = snapshot.id;
    synchronizationBlockedRef.current = conflictedSessionIdsRef.current.has(snapshot.id);
    patchStateRef.current = snapshot.patchState;
    dataStateRef.current = snapshot.dataState;
    isInteractionRequestRef.current = false;
    interactionRegistryRef.current.clear();
    setActiveAnalysisId(snapshot.id);
    setSessionTitle(snapshot.title);
    setMessages(snapshot.messages);
    setTurnResults(snapshot.turnResults);
    setTurnDetails(snapshot.turnDetails);
    setFocusedTurnId(undefined);
    updateGeneratedInterface(snapshot.generatedInterface);
    setPerformance(snapshot.performance);
    setRuntimeDiagnostics(snapshot.runtimeDiagnostics);
    setCorrelationId(snapshot.correlationId);
    setPendingNodeIds(new Set());
    setCanRetry(false);
    setChangeSummary(snapshot.changeSummary);
    setFailure(undefined);
    setSuppressedAnswerId(undefined);
    setActivityMessage("Análisis restaurado");
    useWorkspaceStore.setState({ activePrompt: snapshot.title, draft: "", errorMessage: null });
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [activeAnalysisId, analysisSnapshots, discardBatchedCommit, dispatchExperience, setMessages, stop, updateGeneratedInterface]);

  const dispatchAgentInteraction = useCallback((intent: AgentUIIntent) => {
    if (synchronizationBlockedRef.current) return false;
    if (!interactionRegistryRef.current.begin(intent)) return false;
    lastInteractionIntentRef.current = intent;
    lastRequestKindRef.current = "interaction";
    isInteractionRequestRef.current = true;
    requestedSourcesRef.current = [];
    isFollowUpRequestRef.current = true;
    pendingChangesRef.current = [];
    clientRequestStartedAtRef.current = globalThis.performance.now();
    frontendTimeToFirstUsefulUiRef.current = undefined;
    setCanRetry(false);
    setChangeSummary(undefined);
    setFailure(undefined);
    setSuppressedAnswerId(messages.findLast((message) => message.role === "assistant")?.id);
    setActivityMessage("Actualizando este análisis");
    setPendingNodeIds((current) => new Set(current).add(intent.event.sourceId));
    dispatchExperience({ type: "UI_UPDATE_STARTED" });
    void sendMessage(undefined, { body: { submittedAt: Date.now(), uiEvent: intent } });
    return true;
  }, [dispatchExperience, messages, sendMessage]);

  const handleUIEvent = useCallback((event: LocalUIEvent) => {
    if (isHistoricalView) return;
    const policy = classifyInteractionEvent(event.name);
    if (policy.delivery === "local") {
      if (event.name === "form.value.changed" && typeof event.value === "string") {
        if (formDraftsRef.current.size >= 128 && !formDraftsRef.current.has(`${sessionIdRef.current}:${event.sourceId}`)) {
          formDraftsRef.current.delete(formDraftsRef.current.keys().next().value!);
        }
        formDraftsRef.current.set(`${sessionIdRef.current}:${event.sourceId}`, event.value);
        setFailure((current) => current?.code === "form_validation" ? undefined : current);
      }
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
      || synchronizationBlockedRef.current
      || !sessionId
      || !patchState
      || status !== "ready"
      || interactionRegistryRef.current.isPending(event.sourceId)
    ) {
      return;
    }

    const formValues = event.name === "form.submit"
      ? collectFormValues(patchState.specification, event.sourceId, new Map([...formDraftsRef.current].filter(([key]) => key.startsWith(`${sessionId}:`)).map(([key, value]) => [key.slice(sessionId.length + 1), value])))
      : undefined;
    if (formValues === null) {
      setActivityMessage("Completa los campos requeridos antes de revisar");
      setCanRetry(false);
      setFailure(presentAgentFailure({
        code: "form_validation",
        message: "Selecciona origen y destinatario y completa monto y moneda antes de revisar el pago.",
        recoverable: false,
        hasPartialData: true,
      }));
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
      event: formValues ? { name: event.name, sourceId: event.sourceId, formValues } : event.value === undefined
        ? { name: event.name, sourceId: event.sourceId }
        : { name: event.name, sourceId: event.sourceId, value: event.value },
    });
    if (!intent.success) {
      setError("La interacción no cumple el contrato esperado.", "ui");
      return;
    }
    dispatchAgentInteraction(intent.data);
  }, [dispatchAgentInteraction, isHistoricalView, setError, status]);

  const testStaleSimulation = useCallback(() => {
    if (process.env.NODE_ENV !== "development" || window.location.pathname !== "/dev/ui-interaction-harness") return;
    const previous = lastInteractionIntentRef.current;
    if (!previous || status !== "ready" || synchronizationBlockedRef.current
      || previous.sessionId !== sessionIdRef.current
      || classifyInteractionEvent(previous.event.name).kind !== "simulation"
      || previous.interfaceRevision >= (patchStateRef.current?.revision ?? 0)) return;
    dispatchAgentInteraction({ ...previous, correlationId: crypto.randomUUID() });
  }, [dispatchAgentInteraction, status]);

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
    if (synchronizationBlockedRef.current) return;
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

  const recoverSnapshot = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !synchronizationBlockedRef.current || isRecoveringSnapshot
      || status === "submitted" || status === "streaming") return;
    const epoch = ++recoveryEpochRef.current;
    setIsRecoveringSnapshot(true);
    setActivityMessage("Recuperando la UI y sus datos sin repetir la operación");
    void (async () => {
      try {
        const response = await fetch("/api/agent/snapshot", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }), signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error("Snapshot no disponible");
        const restored = restoreSessionUiSnapshot(await response.json(), sessionId);
        if (epoch !== recoveryEpochRef.current || sessionIdRef.current !== sessionId) return;
        const focusedControl = captureGeneratedUIFocus();
        discardBatchedCommit();
        patchStateRef.current = restored.ui;
        dataStateRef.current = restored.data;
        updateGeneratedInterface({ specification: restored.ui.specification,
          data: restored.data.data, revision: restored.ui.revision, updatedAt: Date.now() });
        synchronizationBlockedRef.current = false;
        conflictedSessionIdsRef.current.delete(sessionId);
        setFailure(undefined);
        setCanRetry(false);
        setActivityMessage("UI y datos sincronizados con el backend");
        useWorkspaceStore.setState({ errorMessage: null });
        dispatchExperience({ type: "RESTORE_SESSION" });
        restoreGeneratedUIFocusAfterCommit(focusedControl);
      } catch {
        if (epoch === recoveryEpochRef.current && sessionIdRef.current === sessionId) {
          setActivityMessage("Snapshot no disponible; conservamos la vista y el bloqueo de esta sesión");
        }
      } finally {
        if (epoch === recoveryEpochRef.current) setIsRecoveringSnapshot(false);
      }
    })();
  }, [discardBatchedCommit, dispatchExperience, isRecoveringSnapshot, status, updateGeneratedInterface]);

  const continueWithPartialData = useCallback(() => {
    if (!failure?.canContinue || !generatedInterface) return;
    if (synchronizationBlockedRef.current) {
      setActivityMessage("Puedes consultar la vista conservada; sincroniza antes de continuar este análisis");
      return;
    }
    setFailure(undefined);
    setCanRetry(false);
    dispatchExperience({ type: "RESTORE_SESSION" });
  }, [dispatchExperience, failure?.canContinue, generatedInterface]);

  const value = useMemo<AgentSessionValue>(() => ({
    activeAnalysisId,
    activityMessage,
    analysisHistory: analysisSnapshots.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
    answer,
    conversationTurns,
    focusedTurnId,
    focusTurn,
    displayedInterface,
    isHistoricalView,
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
    recoverSnapshot,
    testStaleSimulation,
    isRecoveringSnapshot,
    selectAnalysis,
    runtimeDiagnostics,
    sendPrompt,
    sessionTitle,
    startNewSession,
  }), [activeAnalysisId, activityMessage, analysisSnapshots, answer, conversationTurns, focusedTurnId, focusTurn, displayedInterface, isHistoricalView, canRetry, cancel, changeSummary, continueWithPartialData, correlationId, failure, frontendPerformance, generatedInterface, handleUIEvent, pendingNodeIds, performance, retryLastRequest, recoverSnapshot, testStaleSimulation, isRecoveringSnapshot, runtimeDiagnostics, selectAnalysis, sendPrompt, sessionTitle, startNewSession]);

  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

export function useAgentSession() {
  const value = useContext(AgentSessionContext);
  if (!value) throw new Error("useAgentSession requiere AgentSessionProvider");
  return value;
}
