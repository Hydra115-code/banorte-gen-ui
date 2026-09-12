import { systemStatusSchema, type SystemStatus } from "@banorte/contracts";

export interface SystemStatusRequestOptions {
  fetchImplementation?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function requestSystemStatus(
  url = "/api/system/status",
  options: SystemStatusRequestOptions = {},
): Promise<SystemStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await (options.fetchImplementation ?? fetch)(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new SystemStatusRequestError("El backend no está disponible");
    const result = systemStatusSchema.safeParse(await response.json());
    if (!result.success) throw new SystemStatusRequestError("El backend devolvió un estado inválido");
    return result.data;
  } catch (error) {
    if (error instanceof SystemStatusRequestError) throw error;
    if (controller.signal.aborted) throw new SystemStatusRequestError("La comprobación agotó el tiempo de espera");
    throw new SystemStatusRequestError("No fue posible conectar con el backend");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export class SystemStatusRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SystemStatusRequestError";
  }
}
