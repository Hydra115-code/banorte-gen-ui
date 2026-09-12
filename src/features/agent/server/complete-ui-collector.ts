import type { UINode, UISpecification } from "@banorte/contracts";
import type { DataRegistryValue } from "../../generative-ui/data-binding/schemas/data-registry-schema.ts";
import {
  applyDataRegistryPatch,
  createDataRegistryPatchState,
  type DataRegistryPatchState,
} from "../../generative-ui/data-binding/registry/data-registry-patch-engine.ts";
import {
  applyUIPatch,
  createUIPatchState,
  type UIPatchState,
} from "../../generative-ui/patches/ui-patch-engine.ts";

export class CompleteUICollectionError extends Error {
  readonly code: "data_patch_invalid" | "ui_patch_invalid" | "ui_incomplete";

  constructor(code: "data_patch_invalid" | "ui_patch_invalid" | "ui_incomplete") {
    super(code);
    this.name = "CompleteUICollectionError";
    this.code = code;
  }
}

export class CompleteUICollector {
  private dataState: DataRegistryPatchState = createDataRegistryPatchState();
  private uiState: UIPatchState | undefined;
  private completedRevision: number | undefined;
  private dataPatchCount = 0;

  observe(input: unknown): void {
    if (!isRecord(input) || typeof input.type !== "string") return;
    const event = input;
    if (event.type === "data-available") {
      if (typeof event.key !== "string") throw new CompleteUICollectionError("data_patch_invalid");
      this.dataState = createDataRegistryPatchState({
        ...this.dataState.data,
        [event.key]: event.value,
      }, this.dataState.revision);
      this.dataPatchCount += 1;
      return;
    }
    if (event.type === "data-patch") {
      const result = applyDataRegistryPatch(this.dataState, event.patch);
      if (!result.success) throw new CompleteUICollectionError("data_patch_invalid");
      this.dataState = result.state;
      this.dataPatchCount += 1;
      return;
    }
    if (event.type === "ui" || event.type === "ui-started") {
      const result = createUIPatchState(
        event.specification,
        event.type === "ui-started" && typeof event.revision === "number" ? event.revision : 0,
      );
      if (!result.success) throw new CompleteUICollectionError("ui_patch_invalid");
      this.uiState = result.state;
      if (isRecord(event.data)) {
        this.dataState = createDataRegistryPatchState({
          ...this.dataState.data,
          ...event.data,
        }, this.dataState.revision);
      }
      return;
    }
    if (event.type === "ui-patch") {
      if (!this.uiState) throw new CompleteUICollectionError("ui_patch_invalid");
      const result = applyUIPatch(this.uiState, event.patch);
      if (!result.success) throw new CompleteUICollectionError("ui_patch_invalid");
      this.uiState = result.state;
      return;
    }
    if (event.type === "ui-completed" && typeof event.revision === "number") {
      this.completedRevision = event.revision;
    }
  }

  complete(): {
    payload: { specification: UISpecification; data: DataRegistryValue };
    evidence: {
      deliveryMode: "complete";
      dataPatchCount: number;
      dataKeys: string[];
      rootType: string;
      nodeCount: number;
      compositionSignature: string;
      validationResult: "valid";
    };
    revision: number;
  } {
    if (!this.uiState || this.completedRevision !== this.uiState.revision) {
      throw new CompleteUICollectionError("ui_incomplete");
    }
    const nodeTypes: string[] = [];
    visitNodes(this.uiState.specification.root, (node) => nodeTypes.push(node.type));
    return {
      payload: {
        specification: this.uiState.specification,
        data: this.dataState.data,
      },
      evidence: {
        deliveryMode: "complete",
        dataPatchCount: this.dataPatchCount,
        dataKeys: Object.keys(this.dataState.data).sort(),
        rootType: this.uiState.specification.root.type,
        nodeCount: nodeTypes.length,
        compositionSignature: nodeTypes.join(">"),
        validationResult: "valid",
      },
      revision: this.uiState.revision,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visitNodes(node: UINode, visit: (node: UINode) => void): void {
  visit(node);
  if ("children" in node) node.children.forEach((child) => visitNodes(child, visit));
  if (node.type === "tabs" || node.type === "accordion") {
    node.items.forEach((item) => item.children.forEach((child) => visitNodes(child, visit)));
  }
  if (node.type === "repeat") {
    visitNodes(node.template, visit);
    if (node.empty) visitNodes(node.empty, visit);
  }
  if (node.type === "conditional") {
    visitNodes(node.then, visit);
    if (node.else) visitNodes(node.else, visit);
  }
}
