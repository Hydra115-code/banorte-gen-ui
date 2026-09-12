export function shouldExposeRuntimeDiagnostics(environment: string | undefined) {
  return environment === "development";
}
