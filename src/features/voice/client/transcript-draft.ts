export const MAX_VOICE_PROMPT_LENGTH = 2_000;

export function composeTranscriptDraft(
  base: string,
  committedSegments: readonly string[],
  partial = "",
): string {
  return [base, ...committedSegments, partial]
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_VOICE_PROMPT_LENGTH);
}
