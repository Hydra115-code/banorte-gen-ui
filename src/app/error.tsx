"use client";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="workspace-failure">
      <div className="workspace-failure__mark" aria-hidden="true">!</div>
      <p className="canvas__eyebrow">Recuperación segura</p>
      <h1>No pudimos cargar el espacio de trabajo</h1>
      <p>La sesión permanece protegida. Intenta cargar nuevamente la interfaz.</p>
      <button type="button" onClick={reset}>Reintentar</button>
    </main>
  );
}
