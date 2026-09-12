"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  LocalUIEventBus,
  type InteractionValue,
  type LocalUIEventListener,
} from "./local-ui-event";

const UIEventContext = createContext<LocalUIEventBus | null>(null);
const TextDraftContext = createContext<Map<string, string> | null>(null);
const EMPTY_PENDING_NODE_IDS: ReadonlySet<string> = new Set();
const PendingNodeContext = createContext<ReadonlySet<string>>(EMPTY_PENDING_NODE_IDS);

interface UIEventProviderProps {
  children: ReactNode;
  onEvent?: LocalUIEventListener;
  pendingNodeIds?: ReadonlySet<string>;
}

export function UIEventProvider({ children, onEvent, pendingNodeIds = EMPTY_PENDING_NODE_IDS }: UIEventProviderProps) {
  const parentEventBus = useContext(UIEventContext);
  const parentTextDrafts = useContext(TextDraftContext);
  const [localEventBus] = useState(() => new LocalUIEventBus());
  const [textDrafts] = useState(() => new Map<string, string>());
  const eventBus = parentEventBus ?? localEventBus;

  useEffect(() => onEvent ? eventBus.subscribe(onEvent) : undefined, [eventBus, onEvent]);

  return (
    <UIEventContext.Provider value={eventBus}>
      <TextDraftContext.Provider value={parentTextDrafts ?? textDrafts}>
        <PendingNodeContext.Provider value={pendingNodeIds}>{children}</PendingNodeContext.Provider>
      </TextDraftContext.Provider>
    </UIEventContext.Provider>
  );
}

export function useTextDraft(key: string, initialValue: string) {
  const drafts = useContext(TextDraftContext);
  const [value, setValue] = useState(() => drafts?.get(key) ?? initialValue);
  const update = (nextValue: string) => {
    if (drafts) {
      if (!drafts.has(key) && drafts.size >= 128) drafts.delete(drafts.keys().next().value!);
      drafts.set(key, nextValue);
    }
    setValue(nextValue);
  };
  return [value, update] as const;
}

export function useNodePending(sourceId: string | undefined) {
  const pendingNodeIds = useContext(PendingNodeContext);
  return sourceId ? pendingNodeIds.has(sourceId) : false;
}

export function useUIEventBus() {
  return useContext(UIEventContext);
}

export function useInteractionEvent(sourceId: string, name: string) {
  const eventBus = useUIEventBus();

  return useCallback(
    (value: InteractionValue | undefined, isValid = true) => eventBus?.dispatch(
      value === undefined ? { name, sourceId, isValid } : { name, sourceId, value, isValid },
    ) ?? false,
    [eventBus, name, sourceId],
  );
}
