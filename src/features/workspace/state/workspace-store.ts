import { create } from "zustand";
import {
  createInitialExperienceState,
  isExperienceBusy,
  transitionExperience,
  type ExperienceEvent,
  type ExperienceState,
  type ExperienceTransition,
} from "./experience-state-machine";

interface WorkspaceState {
  activePrompt: string | null;
  draft: string;
  errorMessage: string | null;
  experience: ExperienceState;
  dispatchExperience: (event: ExperienceEvent) => ExperienceTransition;
  reset: () => void;
  setDraft: (draft: string) => void;
  setError: (message: string, scope?: Extract<ExperienceEvent, { type: "FAIL" }>["scope"]) => void;
  submitPrompt: (prompt?: string) => string | null;
}

function createInitialState() {
  const experience = createInitialExperienceState();
  return {
    activePrompt: null,
    draft: "",
    errorMessage: null,
    experience,
  };
}

const initialState = createInitialState();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initialState,
  dispatchExperience: (event) => {
    const result = transitionExperience(get().experience, event);
    if (result.accepted) {
      set({
        experience: result.state,
        ...(event.type === "FAIL" ? {} : { errorMessage: null }),
      });
    }
    return result;
  },
  reset: () => set(createInitialState()),
  setDraft: (draft) => set({ draft }),
  setError: (message, scope = "conversation") => {
    const result = transitionExperience(get().experience, { type: "FAIL", scope });
    if (!result.accepted) return;
    set({ errorMessage: message, experience: result.state });
  },
  submitPrompt: (providedPrompt) => {
    const { draft, experience } = get();
    const prompt = (providedPrompt ?? draft).trim();
    if (!prompt || isExperienceBusy(experience.status)) return null;
    const result = transitionExperience(experience, { type: "SUBMIT" });
    if (!result.accepted) return null;
    set({
      activePrompt: prompt,
      draft: "",
      errorMessage: null,
      experience: result.state,
    });
    return prompt;
  },
}));

export function resetWorkspaceStore(): void {
  useWorkspaceStore.setState(createInitialState());
}
