"use client";

import { Component, type ReactNode } from "react";
import { ErrorNode } from "./ErrorNode";

interface NodeErrorBoundaryProps {
  children: ReactNode;
  isRecovering?: boolean;
  onRegenerate?: () => void;
  resetKey?: unknown;
  title?: string;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
}

export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  state: NodeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): NodeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: NodeErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorNode
          isRecovering={this.props.isRecovering}
          message="El resto de la interfaz continúa disponible. Puedes volver a intentarlo o pedir al agente que reconstruya esta sección."
          onRegenerate={this.props.onRegenerate}
          onRetry={this.retry}
          title={this.props.title ?? "No se pudo mostrar esta sección"}
        />
      );
    }

    return this.props.children;
  }
}
