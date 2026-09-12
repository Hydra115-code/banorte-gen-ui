import type { BindingResolverOptions } from "../data-binding/resolver/BindingResolver";
import { DataRegistry } from "../data-binding/registry/DataRegistry";
import { UINodeRenderer } from "../runtime/LayoutRenderer";
import { validateUISpecification } from "../schemas/ui-specification";
import { ErrorNode } from "./ErrorNode";
import { UnknownNode } from "./UnknownNode";
import type { LocalUIEventListener } from "../interactions/events/local-ui-event";
import { knownNodeTypes } from "../runtime/node-capability-matrix";
import { isTrustedUINode } from "../patches/trusted-ui-specification";

interface NodeRendererProps {
  node: unknown;
  dataRegistry?: DataRegistry;
  bindingOptions?: BindingResolverOptions;
  onEvent?: LocalUIEventListener;
  pendingNodeIds?: ReadonlySet<string>;
}

function readNodeType(node: unknown) {
  try {
    if (node === null || typeof node !== "object") return undefined;
    const type = Reflect.get(node, "type");
    return typeof type === "string" ? type.slice(0, 64) : undefined;
  } catch {
    return undefined;
  }
}

export function NodeRenderer({ node, dataRegistry, bindingOptions, onEvent, pendingNodeIds }: NodeRendererProps) {
  const result = isTrustedUINode(node)
    ? { success: true as const, data: { version: "1" as const, root: node }, errors: [] as [] }
    : validateUISpecification({ version: "1", root: node });

  if (!result.success) {
    const nodeType = readNodeType(node);
    if (nodeType && !knownNodeTypes.has(nodeType)) return <UnknownNode nodeType={nodeType} />;
    return <ErrorNode title="El elemento no cumple el contrato de interfaz" />;
  }

  const validatedNode = isTrustedUINode(node) ? node : result.data.root;

  return (
    <UINodeRenderer
      bindingOptions={bindingOptions}
      dataRegistry={dataRegistry}
      node={validatedNode}
      onEvent={onEvent}
      pendingNodeIds={pendingNodeIds}
    />
  );
}
