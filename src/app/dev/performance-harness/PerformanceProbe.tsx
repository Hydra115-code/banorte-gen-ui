"use client";

import { useEffect, useRef, useState } from "react";
import type { UIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { FrameCommitBatcher } from "@/features/agent/performance/frame-commit-batcher";
import { FrontendPerformanceSampler } from "@/features/agent/performance/frontend-performance-sampler";
import { buildPerformancePatches, buildPerformanceSpecification } from "@/features/generative-ui/fixtures/f10-performance-fixture";
import { applyUIPatch, createUIPatchState } from "@/features/generative-ui/patches/ui-patch-engine";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import styles from "../contract-harness/page.module.css";

const NORMAL_VIEW_GROUPS = 5;
const NORMAL_VIEW_NODE_COUNT = 106;

function initialState(): UIPatchState {
  const result = createUIPatchState(buildPerformanceSpecification(NORMAL_VIEW_GROUPS));
  if (!result.success) throw new Error("Fixture de rendimiento inválido");
  return result.state;
}

export function PerformanceProbe() {
  const [patchState, setPatchState] = useState(initialState);
  const [result, setResult] = useState(`Listo para medir 60 patches sobre ${NORMAL_VIEW_NODE_COUNT} nodos.`);
  const batcherRef = useRef<FrameCommitBatcher<UIPatchState> | null>(null);
  const samplerRef = useRef(new FrontendPerformanceSampler());
  const patchStartsRef = useRef<number[]>([]);
  const renderCountRef = useRef(0);
  const renderBaselineRef = useRef(0);
  renderCountRef.current += 1;

  useEffect(() => {
    if (patchState.revision !== 60) return;
    const frame = requestAnimationFrame(() => {
      const paintedAt = performance.now();
      patchStartsRef.current.splice(0).forEach((startedAt) => samplerRef.current.recordPatchToPaint(paintedAt - startedAt));
      const summary = samplerRef.current.snapshot();
      const stats = batcherRef.current?.stats;
      const passes = (summary.patchToPaintP95Ms ?? Infinity) < 100 && stats?.commits === 1;
      setResult(`${passes ? "Correcto" : "Revisar"}: p50 ${summary.patchToPaintP50Ms} ms · p95 ${summary.patchToPaintP95Ms} ms · ${stats?.enqueued} patches → ${stats?.commits} commit · ${renderCountRef.current - renderBaselineRef.current} renders.`);
    });
    return () => cancelAnimationFrame(frame);
  }, [patchState]);

  function runBenchmark() {
    samplerRef.current.reset();
    patchStartsRef.current = [];
    renderBaselineRef.current = renderCountRef.current;
    let next = initialState();
    batcherRef.current?.discard();
    batcherRef.current = new FrameCommitBatcher((state) => setPatchState(state));
    for (const patch of buildPerformancePatches(60, NORMAL_VIEW_GROUPS)) {
      const startedAt = performance.now();
      const applied = applyUIPatch(next, patch);
      if (!applied.success) {
        setResult(`Falló en revisión ${patch.revision}: ${applied.error.code}`);
        return;
      }
      samplerRef.current.recordPatchApply(performance.now() - startedAt);
      patchStartsRef.current.push(startedAt);
      next = applied.state;
      batcherRef.current.enqueue(next);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>F10 · rendimiento frontend · vista normal de {NORMAL_VIEW_NODE_COUNT} nodos</p>
        <h1>Benchmark de ráfaga contractual</h1>
        <p aria-live="polite" role="status">{result}</p>
        <button type="button" onClick={runBenchmark}>Ejecutar benchmark</button>
      </header>
      <div className={styles.gallery}>
        <article className={styles.fixture}>
          <UIRenderer specification={patchState.specification} />
        </article>
      </div>
    </main>
  );
}
