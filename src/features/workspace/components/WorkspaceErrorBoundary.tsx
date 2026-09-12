"use client";

import { Component, type ReactNode } from "react";

interface WorkspaceErrorBoundaryProps {
  children: ReactNode;
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
}

export class WorkspaceErrorBoundary extends Component<WorkspaceErrorBoundaryProps, WorkspaceErrorBoundaryState> {
  state: WorkspaceErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { hasError: true };
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="workspace-failure">
          <div className="workspace-failure__mark" aria-hidden="true">!</div>
          <p className="canvas__eyebrow">Espacio protegido</p>
          <h1>La interfaz encontró un problema inesperado</h1>
          <p>Tu información no fue modificada. Puedes intentar restaurar el espacio de trabajo.</p>
          <button type="button" onClick={this.retry}>Restaurar interfaz</button>
        </main>
      );
    }

    return this.props.children;
  }
}
