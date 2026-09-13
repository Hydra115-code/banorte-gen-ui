export function voiceFailureMessage(error: unknown): string {
  const candidate = error && typeof error === "object" ? error as { name?: unknown; message?: unknown } : null;
  const name = typeof candidate?.name === "string" ? candidate.name.toLowerCase() : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  if (name === "notallowederror" || name === "securityerror"
    || message.includes("permission") || message.includes("denied")) {
    return "Permiso de micrófono denegado. Puedes escribir tu consulta.";
  }
  if (name === "notfounderror" || name === "notreadableerror") {
    return "No encontramos un micrófono disponible. Puedes escribir tu consulta.";
  }
  return "No fue posible iniciar el dictado por voz. Puedes escribir tu consulta.";
}
