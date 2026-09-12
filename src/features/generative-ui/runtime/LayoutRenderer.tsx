"use client";

import { memo, useMemo, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import type { UINode } from "../schemas/layout-node";
import { BindingResolver, type BindingResolverOptions } from "../data-binding/resolver/BindingResolver";
import { DataRegistry } from "../data-binding/registry/DataRegistry";
import { Alert } from "../primitives/content/Alert";
import { Badge } from "../primitives/content/Badge";
import { Heading } from "../primitives/content/Heading";
import { Icon } from "../primitives/content/Icon";
import { List } from "../primitives/content/List";
import { Metric } from "../primitives/content/Metric";
import { Progress } from "../primitives/content/Progress";
import { Text } from "../primitives/content/Text";
import { Accordion } from "../primitives/layout/Accordion";
import { Container } from "../primitives/layout/Container";
import { Divider } from "../primitives/layout/Divider";
import { Flex } from "../primitives/layout/Flex";
import { Grid } from "../primitives/layout/Grid";
import { Scrollable } from "../primitives/layout/Scrollable";
import { Section } from "../primitives/layout/Section";
import { Split } from "../primitives/layout/Split";
import { Stack } from "../primitives/layout/Stack";
import { Tabs } from "../primitives/layout/Tabs";
import { Visualization } from "../visualization/Visualization";
import { Table } from "../table/Table";
import { Button } from "../interactions/components/Button";
import { Checkbox } from "../interactions/components/Checkbox";
import { DatePicker } from "../interactions/components/DatePicker";
import { DateRange } from "../interactions/components/DateRange";
import { Input } from "../interactions/components/Input";
import { MultiSelect } from "../interactions/components/MultiSelect";
import { NumberInput } from "../interactions/components/NumberInput";
import { RadioGroup } from "../interactions/components/RadioGroup";
import { Select } from "../interactions/components/Select";
import { Slider } from "../interactions/components/Slider";
import { Switch } from "../interactions/components/Switch";
import { UIEventProvider, useNodePending, useUIEventBus } from "../interactions/events/UIEventProvider";
import type { LocalUIEventListener } from "../interactions/events/local-ui-event";
import { evaluateCondition } from "../logic/evaluate-condition";
import { MAX_REPEAT_ITERATIONS } from "../schemas/logic-node";
import { NodeErrorBoundary } from "../renderer/NodeErrorBoundary";
import { UnknownNode } from "../renderer/UnknownNode";
import { RuntimeMotionNode } from "./RuntimeMotionNode";
import { controlCompatibilityKey } from "../interactions/reconciliation/control-compatibility-key";

const loadRuntimeMotionFeatures = () => import("./runtime-motion-features").then((module) => module.default);

interface UINodeRendererProps {
  node: UINode;
  dataRegistry?: DataRegistry;
  bindingOptions?: BindingResolverOptions;
  onEvent?: LocalUIEventListener;
  pendingNodeIds?: ReadonlySet<string>;
}

function renderChildren(
  children: UINode[],
  resolver?: BindingResolver,
  bindingOptions?: BindingResolverOptions,
  instanceSuffix?: string,
) {
  return (
    <>
      {children.map((child, index) => (
        <ResolvedNode
          bindingOptions={bindingOptions}
          key={child.id ?? `${child.type}-${index}`}
          node={child}
          position={index}
          resolver={resolver}
          instanceSuffix={instanceSuffix}
        />
      ))}
    </>
  );
}

interface ResolvedNodeProps {
  node: UINode;
  resolver?: BindingResolver;
  bindingOptions?: BindingResolverOptions;
  instanceSuffix?: string;
  position?: number;
}

function expectedTypeForFormat(format: "currency" | "number" | "percent" | "date" | "text" | undefined) {
  if (format === "currency" || format === "number" || format === "percent") return "number" as const;
  if (format === "date") return "date" as const;
  return undefined;
}

function interactionId(id: string, instanceSuffix?: string) {
  if (!instanceSuffix) return id;

  const suffix = `-${instanceSuffix}`;
  return `${id.slice(0, 64 - suffix.length)}${suffix}`;
}

function optionalInteractionId(id: string | undefined, instanceSuffix?: string) {
  return id ? interactionId(id, instanceSuffix) : undefined;
}

function PendingNode({ id, children }: { id?: string; children: ReactNode }) {
  const isPending = useNodePending(id);
  return (
    <div aria-busy={isPending || undefined} className="ui-runtime-node" data-loading={isPending || undefined}>
      {children}
    </div>
  );
}

const ResolvedNode = memo(function ResolvedNode(props: ResolvedNodeProps) {
  const eventBus = useUIEventBus();
  const sourceId = optionalInteractionId(props.node.id, props.instanceSuffix);
  const isRecovering = useNodePending(sourceId);
  const regenerate = sourceId
    ? () => eventBus?.dispatch({ name: "ui.section.regenerate", sourceId, isValid: true })
    : undefined;

  return (
    <RuntimeMotionNode isPending={isRecovering} node={props.node} position={props.position}>
      <NodeErrorBoundary
        isRecovering={isRecovering}
        onRegenerate={regenerate}
        resetKey={props.node}
        title={props.node.type === "visualization" ? "No pudimos mostrar esta visualización" : undefined}
      >
        <ResolvedNodeContent {...props} />
      </NodeErrorBoundary>
    </RuntimeMotionNode>
  );
});

const ResolvedNodeContent = memo(function ResolvedNodeContent({ node, resolver, bindingOptions, instanceSuffix }: ResolvedNodeProps) {
  switch (node.type) {
    case "container":
      return <Container padding={node.padding} size={node.size}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Container>;
    case "section":
      return <Section ariaLabel={node.ariaLabel} padding={node.padding} surface={node.surface}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Section>;
    case "stack":
      return <Stack align={node.align} gap={node.gap}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Stack>;
    case "grid":
      return <Grid align={node.align} columns={node.columns} gap={node.gap}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Grid>;
    case "flex":
      return <Flex align={node.align} direction={node.direction} gap={node.gap} justify={node.justify} wrap={node.wrap}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Flex>;
    case "split":
      return <Split collapseAt={node.collapseAt} gap={node.gap} ratio={node.ratio}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Split>;
    case "scrollable":
      return <Scrollable ariaLabel={node.ariaLabel} axis={node.axis} id={optionalInteractionId(node.id, instanceSuffix)} maxSize={node.maxSize}>{renderChildren(node.children, resolver, bindingOptions, instanceSuffix)}</Scrollable>;
    case "divider":
      return <Divider orientation={node.orientation} strength={node.strength} />;
    case "tabs":
      return (
        <Tabs
          ariaLabel={node.ariaLabel}
          defaultValue={node.defaultValue}
          id={optionalInteractionId(node.id, instanceSuffix)}
          items={node.items.map((item) => ({ ...item, children: renderChildren(item.children, resolver, bindingOptions, instanceSuffix) }))}
        />
      );
    case "accordion":
      return (
        <Accordion
          defaultOpen={node.defaultOpen}
          id={optionalInteractionId(node.id, instanceSuffix)}
          mode={node.mode}
          items={node.items.map((item) => ({ ...item, children: renderChildren(item.children, resolver, bindingOptions, instanceSuffix) }))}
        />
      );
    case "text":
      return <Text align={node.align} content={node.content} tone={node.tone} variant={node.variant} />;
    case "heading":
      return <Heading align={node.align} content={node.content} level={node.level} size={node.size} />;
    case "metric":
      {
        const label = node.labelBinding
          ? resolver?.resolve({ path: node.labelBinding, expectedType: "string" }).formattedValue
          : node.label;

        return (
          <Metric
            comparison={node.comparisonBinding ? resolver?.resolve({ path: node.comparisonBinding }).formattedValue : undefined}
            importance={node.importance}
            label={label ?? "Dato sin etiqueta"}
            semanticState={node.semanticState}
            trend={node.trendBinding ? resolver?.resolve({ path: node.trendBinding }).formattedValue : undefined}
            value={resolver?.resolve({
              path: node.valueBinding,
              format: node.format,
              expectedType: node.valueType ?? expectedTypeForFormat(node.format),
              fallback: node.fallback,
            }).formattedValue ?? undefined}
          />
        );
      }
    case "badge":
      return <Badge {...node} />;
    case "alert":
      return <Alert {...node} />;
    case "progress":
      {
        const resolution = resolver?.resolve({
          path: node.valueBinding,
          expectedType: "number",
          fallback: node.fallback,
        });
        const value = resolution?.status === "resolved" && typeof resolution.value === "number"
          ? resolution.value
          : node.fallback;

        return <Progress {...node} value={value} />;
      }
    case "icon":
      return <Icon {...node} />;
    case "list":
      return <List {...node} />;
    case "visualization":
      {
        const resolution = resolver?.resolve({ path: node.dataBinding, expectedType: "array" });
        const data = resolution?.status === "resolved" && Array.isArray(resolution.value)
          ? resolution.value
          : undefined;

        return <Visualization data={data} spec={node} />;
      }
    case "table":
      {
        const resolution = resolver?.resolve({ path: node.dataBinding, expectedType: "array" });
        const data = resolution?.status === "resolved" && Array.isArray(resolution.value)
          ? resolution.value
          : undefined;

        const resolvedId = optionalInteractionId(node.id, instanceSuffix);
        const resolvedNode = resolvedId ? { ...node, id: resolvedId } : node;

        return (
          <PendingNode id={resolvedId}><Table
            currency={bindingOptions?.currency}
            data={data}
            locale={bindingOptions?.locale}
            spec={resolvedNode}
          /></PendingNode>
        );
      }
    case "button":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Button {...node} id={interactionId(node.id, instanceSuffix)} /></PendingNode>;
    case "input":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Input {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "numberInput":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><NumberInput {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "select":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Select {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "multiSelect":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><MultiSelect {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "slider":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Slider {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "datePicker":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><DatePicker {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "dateRange":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><DateRange {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "checkbox":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Checkbox {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "switch":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><Switch {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "radioGroup":
      return <PendingNode id={interactionId(node.id, instanceSuffix)}><RadioGroup {...node} id={interactionId(node.id, instanceSuffix)} key={controlCompatibilityKey(node)} /></PendingNode>;
    case "repeat":
      {
        const resolution = resolver?.resolve({ path: node.dataBinding, expectedType: "array" });
        const items = resolution?.status === "resolved" && Array.isArray(resolution.value)
          ? resolution.value.slice(0, MAX_REPEAT_ITERATIONS)
          : [];

        if (items.length === 0) {
          return node.empty
            ? <ResolvedNode bindingOptions={bindingOptions} instanceSuffix={instanceSuffix} node={node.empty} resolver={resolver} />
            : null;
        }

        return items.map((item, index) => {
          const repeatedSuffix = instanceSuffix ? `${instanceSuffix}-${index + 1}` : `${index + 1}`;
          return (
            <ResolvedNode
              bindingOptions={bindingOptions}
              instanceSuffix={repeatedSuffix}
              key={repeatedSuffix}
              node={node.template}
              position={index}
              resolver={resolver?.withScope(item, index)}
            />
          );
        });
      }
    case "conditional":
      {
        const resolution = resolver?.resolve({ path: node.condition.binding });
        const branch = evaluateCondition(node.condition, resolution?.value)
          ? node.then
          : node.else;

        return branch
          ? <ResolvedNode bindingOptions={bindingOptions} instanceSuffix={instanceSuffix} node={branch} resolver={resolver} />
          : null;
      }
    default:
      return <UnknownNode />;
  }
});

export function UINodeRenderer({ node, dataRegistry, bindingOptions, onEvent, pendingNodeIds }: UINodeRendererProps) {
  const resolver = useMemo(
    () => dataRegistry ? new BindingResolver(dataRegistry, bindingOptions) : undefined,
    [bindingOptions, dataRegistry],
  );
  return (
    <LazyMotion features={loadRuntimeMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <UIEventProvider onEvent={onEvent} pendingNodeIds={pendingNodeIds}>
          <ResolvedNode bindingOptions={bindingOptions} node={node} resolver={resolver} />
        </UIEventProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

export const LayoutRenderer = UINodeRenderer;
