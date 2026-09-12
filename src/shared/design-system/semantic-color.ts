import { z } from "zod";

export const semanticColorTokens = [
  "financial.positive",
  "financial.negative",
  "financial.neutral",
  "financial.warning",
  "surface.primary",
  "surface.secondary",
  "surface.elevated",
  "text.primary",
  "text.secondary",
  "text.muted",
  "border.subtle",
  "border.strong",
  "status.success",
  "status.warning",
  "status.error",
  "status.info",
] as const;

export const semanticColorTokenSchema = z.enum(semanticColorTokens);

export type SemanticColorToken = z.infer<typeof semanticColorTokenSchema>;

export function resolveSemanticColor(input: unknown): string | null {
  const result = semanticColorTokenSchema.safeParse(input);

  if (!result.success) {
    return null;
  }

  return `var(--color-${result.data.replace(".", "-")})`;
}
