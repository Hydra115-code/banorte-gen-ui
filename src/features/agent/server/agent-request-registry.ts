import "server-only";

interface ActiveRequest {
  accessToken: string;
  controller: AbortController;
}

const activeRequests = new Map<string, ActiveRequest>();

function requestKey(sessionId: string, correlationId: string) {
  return `${sessionId}:${correlationId}`;
}

export function registerAgentRequest(sessionId: string, correlationId: string, accessToken: string) {
  const key = requestKey(sessionId, correlationId);
  const previous = activeRequests.get(key);
  previous?.controller.abort("superseded");

  const controller = new AbortController();
  activeRequests.set(key, { accessToken, controller });
  return controller;
}

export function unregisterAgentRequest(
  sessionId: string,
  correlationId: string,
  controller: AbortController,
) {
  const key = requestKey(sessionId, correlationId);
  if (activeRequests.get(key)?.controller === controller) activeRequests.delete(key);
}

export function cancelAgentRequest(sessionId: string, correlationId: string, accessToken: string) {
  const request = activeRequests.get(requestKey(sessionId, correlationId));
  if (!request || request.accessToken !== accessToken) return false;
  request.controller.abort("user_cancelled");
  return true;
}
