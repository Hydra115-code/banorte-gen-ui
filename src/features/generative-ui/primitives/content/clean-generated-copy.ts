/** Removes internal answer markers and unrendered Markdown from user-facing copy. */
export function cleanGeneratedCopy(content: string): string {
  return content
    .replace(/\r\n?/gu, "\n")
    .replace(/[*`]/gu, "")
    .replace(/^#{1,6}[ \t]+/gmu, "")
    .replace(/(^|\n)[ \t]*\[?OBSERVED\]?[ \t]*:?[ \t]*/giu, "$1")
    .replace(/(^|\n)[ \t]*\[?SIMULATED\]?[ \t]*:?[ \t]*/giu, "$1Escenario simulado: ")
    .replace(/\btransactionType\s*=\s*transfer\b/giu, "transferencias")
    .replace(/\(\s*sin registros adicionales pendientes de paginación,?\s*hasMore\s*:\s*false\s*\)/giu, "con el historial completo")
    .trim();
}
