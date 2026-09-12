import { useMemo } from "react";
import type { BindingResolverOptions } from "../data-binding/resolver/BindingResolver";
import { DataRegistry } from "../data-binding/registry/DataRegistry";
import { validateUISpecification } from "../schemas/ui-specification";
import { NodeRenderer } from "./NodeRenderer";
import type { LocalUIEventListener } from "../interactions/events/local-ui-event";
import { buildGenericUISpecification } from "../degradation/build-generic-ui";
import { recoverValidData, StructuredResultFallback } from "../degradation/ui-degradation";
import { hasMissingBindings } from "../degradation/detect-missing-bindings";
import { isTrustedUISpecification } from "../patches/trusted-ui-specification";

interface UIRendererProps {
  specification: unknown;
  data?: unknown;
  bindingOptions?: BindingResolverOptions;
  onEvent?: LocalUIEventListener;
  pendingNodeIds?: ReadonlySet<string>;
  degradationReason?: "generation_interrupted" | "partial_data";
}

function resolveDataRegistry(data: unknown) {
  try {
    if (data === undefined) return { registry: undefined, isValid: true };
    if (data instanceof DataRegistry) return { registry: data, isValid: true };
    return { registry: new DataRegistry(data), isValid: true };
  } catch {
    const recovered = recoverValidData(data);
    return {
      registry: recovered ? new DataRegistry(recovered) : undefined,
      isValid: false,
    };
  }
}

export function UIRenderer({
  specification,
  data,
  bindingOptions,
  onEvent,
  pendingNodeIds,
  degradationReason,
}: UIRendererProps) {
  const validation = useMemo(() => isTrustedUISpecification(specification)
    ? { success: true as const, data: specification, errors: [] as [] }
    : validateUISpecification(specification), [specification]);
  const { registry, isValid } = useMemo(() => resolveDataRegistry(data), [data]);
  const hasIncompleteBindings = useMemo(
    () => validation.success && hasMissingBindings(validation.data.root, registry),
    [registry, validation],
  );
  const canRenderIdeal = validation.success && isValid && !hasIncompleteBindings;
  const validatedSpecification = validation.success
    ? (isTrustedUISpecification(specification) ? specification : validation.data)
    : undefined;

  if (canRenderIdeal) {
    if (degradationReason) {
      return (
        <section className="ui-degradation ui-degradation--preserved" data-degradation-level="1" data-generated-ui-root>
          <p className="ui-renderer-message__title" role="status">
            {degradationReason === "generation_interrupted"
              ? "La actualización se interrumpió; conservamos el último resultado válido."
              : "La actualización quedó parcial; conservamos el contenido válido recibido."}
          </p>
          <NodeRenderer
            bindingOptions={bindingOptions}
            dataRegistry={registry}
            node={validatedSpecification!.root}
            onEvent={onEvent}
            pendingNodeIds={pendingNodeIds}
          />
        </section>
      );
    }
    return (
      <div data-generated-ui-root>
        <NodeRenderer
          bindingOptions={bindingOptions}
          dataRegistry={registry}
          node={validatedSpecification!.root}
          onEvent={onEvent}
          pendingNodeIds={pendingNodeIds}
        />
      </div>
    );
  }

  const recoveredData = registry ? { ...registry.snapshot } : null;
  const fallback = recoveredData ? buildGenericUISpecification(recoveredData) : null;
  if (fallback && registry) {
    return (
      <section className="ui-degradation" data-degradation-level="2">
        <NodeRenderer
          bindingOptions={bindingOptions}
          dataRegistry={registry}
          node={fallback.root}
          onEvent={onEvent}
          pendingNodeIds={pendingNodeIds}
        />
      </section>
    );
  }

  const message = degradationReason === "generation_interrupted"
    ? "La generación se interrumpió antes de construir una vista compatible."
    : !isValid
      ? "Parte de los datos recibidos no cumplió el contrato seguro."
      : hasIncompleteBindings
        ? "La respuesta no incluyó todos los datos requeridos por la interfaz."
        : "La interfaz recibida no es válida o utiliza capacidades no compatibles.";
  return <StructuredResultFallback data={recoveredData} message={message} />;
}
