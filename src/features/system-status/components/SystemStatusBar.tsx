"use client";

import { useCallback, useEffect, useState } from "react";
import { type SystemStatus } from "@banorte/contracts";
import { requestSystemStatus } from "../system-status-client";

type LoadStatus = () => Promise<SystemStatus>;

export interface SystemStatusBarProps {
  loadStatus?: LoadStatus;
}

export function SystemStatusBar({ loadStatus = requestSystemStatus }: SystemStatusBarProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus(null);
    setError(null);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let isActive = true;
    loadStatus()
      .then((nextStatus) => {
        if (isActive) setStatus(nextStatus);
      })
      .catch((reason: unknown) => {
        if (isActive) setError(reason instanceof Error ? reason.message : "No fue posible comprobar el sistema");
      });
    return () => {
      isActive = false;
    };
  }, [attempt, loadStatus]);

  if (error) {
    return (
      <section className="system-status system-status--error" aria-label="Estado del sistema" data-connection="disconnected">
        <span>{error}</span>
        <button type="button" onClick={retry}>Reintentar</button>
      </section>
    );
  }

  if (!status) {
    return <section className="system-status" aria-label="Estado del sistema" aria-busy="true" data-connection="checking">Comprobando conexión…</section>;
  }

  return (
    <section
      className="system-status"
      aria-label="Estado del sistema"
      data-connection="connected"
      data-contract-fingerprint={status.contractFingerprint}
      data-health={status.status}
    >
      <Capability label="Backend conectado" isReady={status.backend === "ready"} />
      <Capability label="MCP disponible" isReady={status.mcp === "ready"} />
      <Capability label="Agente listo" isReady={status.agent === "ready"} />
      <span className="system-status__version" title={`Fingerprint ${status.contractFingerprint}`}>
        Contrato v{status.version} · {status.contractFingerprint.slice(0, 8)}
      </span>
    </section>
  );
}

function Capability({ label, isReady }: { label: string; isReady: boolean }) {
  return (
    <span className="system-status__capability" data-ready={isReady}>
      <span aria-hidden="true" />
      {label}
      <span className="sr-only">{isReady ? "disponible" : "no disponible"}</span>
    </span>
  );
}
