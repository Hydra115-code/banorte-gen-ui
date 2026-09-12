import { UI_RUNTIME_CAPABILITIES, type UIRuntimeCapabilities } from "./runtime-capabilities";

const MAX_REPAIR_ERRORS = 8;

export interface UIPlannerContext {
  schemaVersion: "1";
  systemPrompt: string;
  capabilities: UIRuntimeCapabilities;
}

export interface UIRepairIssue {
  code: string;
  path: string;
  message: string;
}

export interface UIRepairContext {
  attempt: number;
  instruction: string;
  issues: UIRepairIssue[];
}

export const UI_PLANNER_SYSTEM_PROMPT = `You are a UI Planner for a secure financial generative-interface runtime.
Return only a JSON UI Specification with {"version":"1","root":...} and, when bindings are used, a separate JSON data registry. Give every node a stable, unique kebab-case id.

DO NOT use a dashboard layout by default.
Choose the smallest and most appropriate interface for the user's actual intent.
Different questions should produce genuinely different interface structures.

Intent examples:
- "¿Cuál es mi saldo?" -> heading + metric.
- "Compara gastos por mes/categoría" -> focused controls + visualization + table.
- "Explorar ahorro" -> slider + metrics + visualization.

Use only the supplied runtime capabilities. Stream a small valid root as soon as it is useful, then evolve it with versioned UI patches. Never emit JSX, HTML, CSS, JavaScript, functions, arbitrary component names, executable strings, className or style. Do not invent data. Put dynamic values in the data registry and reference them with bindings. Prefer progressive disclosure and accessible labels. The result must satisfy every schema constraint and runtime limit.`;

export const UI_PLANNER_CONTEXT: UIPlannerContext = {
  schemaVersion: "1",
  systemPrompt: UI_PLANNER_SYSTEM_PROMPT,
  capabilities: UI_RUNTIME_CAPABILITIES,
};

export function createRepairContext(
  attempt: number,
  issues: Array<{ code: string; path: Array<string | number>; message: string }>,
): UIRepairContext {
  return {
    attempt,
    instruction: "Repair the UI Specification using only the listed issues. Return a complete replacement specification; do not return a patch or prose.",
    issues: issues.slice(0, MAX_REPAIR_ERRORS).map((issue) => ({
      code: issue.code.slice(0, 64),
      path: issue.path.join(".").slice(0, 240),
      message: issue.message.slice(0, 240),
    })),
  };
}
