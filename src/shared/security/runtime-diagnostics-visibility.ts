export function shouldExposeRuntimeDiagnostics(environment: string | undefined, explicitlyRequested = false) {
  return environment === "development" && explicitlyRequested;
}
