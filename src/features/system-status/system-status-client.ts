import {
  CONTRACT_FINGERPRINT,
  errorPayloadSchema,
  systemStatusSchema,
  type SystemStatus,
} from "@banorte/contracts";

export type SystemStatusErrorCode =
  | "backend_unavailable"
  | "contract_fingerprint_mismatch"
  | "invalid_status"
  | "request_aborted"
  | "request_timeout";

export interface SystemStatusRequestOptions {
  fetchImplementation?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  correlationId?: string;
}

export async function requestSystemStatus(
  url = "/api/system/status",
  options: SystemStatusRequestOptions = {},
): Promise<SystemStatus> {
  const retries = Math.max(0, Math.min(options.retries ?? 0, 2));
  let lastError: SystemStatusRequestError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestSystemStatusOnce(url, options);
    } catch (error) {
      lastError = error instanceof SystemStatusRequestError
        ? error
        : new SystemStatusRequestError("No fue posible conectar con el backend", "backend_unavailable");
      if (options.signal?.aborted || !lastError.recoverable || attempt === retries) throw lastError;
    }
  }

  throw lastError ?? new SystemStatusRequestError("No fue posible conectar con el backend", "backend_unavailable");
}

async function requestSystemStatusOnce(
  url: string,
  options: SystemStatusRequestOptions,
): Promise<SystemStatus> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, options.timeoutMs ?? 3_000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const headers = new Headers({ Accept: "application/json" });
    if (options.correlationId) headers.set("X-Correlation-ID", options.correlationId);
    const response = await (options.fetchImplementation ?? fetch)(url, {
      method: "GET",
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = errorPayloadSchema.safeParse(payload);
      throw new SystemStatusRequestError(
        error.success ? error.data.message : "El backend no está disponible",
        "backend_unavailable",
        error.success ? error.data.recoverable : true,
      );
    }
    const result = systemStatusSchema.safeParse(payload);
    if (!result.success) {
      throw new SystemStatusRequestError("El backend devolvió un estado inválido", "invalid_status", false);
    }
    if (result.data.contractFingerprint !== CONTRACT_FINGERPRINT) {
      throw new SystemStatusRequestError(
        "El frontend y el backend usan contratos incompatibles",
        "contract_fingerprint_mismatch",
        false,
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof SystemStatusRequestError) throw error;
    if (didTimeout) throw new SystemStatusRequestError("La comprobación agotó el tiempo de espera", "request_timeout");
    if (options.signal?.aborted) throw new SystemStatusRequestError("La comprobación fue cancelada", "request_aborted", false);
    throw new SystemStatusRequestError("No fue posible conectar con el backend", "backend_unavailable");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export class SystemStatusRequestError extends Error {
  readonly code: SystemStatusErrorCode;
  readonly recoverable: boolean;

  constructor(
    message: string,
    code: SystemStatusErrorCode,
    recoverable = true,
  ) {
    super(message);
    this.name = "SystemStatusRequestError";
    this.code = code;
    this.recoverable = recoverable;
  }
}
