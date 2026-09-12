export interface GeneratedUIFocusSnapshot {
  id: string;
  selectionEnd?: number;
  selectionStart?: number;
}

const GENERATED_UI_ROOT = "[data-generated-ui-root]";

export function captureGeneratedUIFocus(documentObject: Document = document): GeneratedUIFocusSnapshot | null {
  const active = documentObject.activeElement;
  if (!(active instanceof HTMLElement) || !active.id || !active.closest(GENERATED_UI_ROOT)) return null;

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return {
      id: active.id,
      ...(active.selectionStart === null ? {} : { selectionStart: active.selectionStart }),
      ...(active.selectionEnd === null ? {} : { selectionEnd: active.selectionEnd }),
    };
  }
  return { id: active.id };
}

export function restoreGeneratedUIFocus(
  snapshot: GeneratedUIFocusSnapshot | null,
  documentObject: Document = document,
): boolean {
  if (!snapshot) return false;
  const current = documentObject.activeElement;
  if (current instanceof HTMLElement && current.closest(GENERATED_UI_ROOT)) return true;

  const target = documentObject.getElementById(snapshot.id);
  if (!(target instanceof HTMLElement) || !target.closest(GENERATED_UI_ROOT)) return false;
  target.focus({ preventScroll: true });
  if (
    snapshot.selectionStart !== undefined
    && snapshot.selectionEnd !== undefined
    && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
  ) {
    try {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
      // Some input types do not expose text selection.
    }
  }
  return documentObject.activeElement === target;
}

export function restoreGeneratedUIFocusAfterCommit(snapshot: GeneratedUIFocusSnapshot | null): void {
  if (!snapshot || typeof window === "undefined") return;
  requestAnimationFrame(() => restoreGeneratedUIFocus(snapshot));
}
