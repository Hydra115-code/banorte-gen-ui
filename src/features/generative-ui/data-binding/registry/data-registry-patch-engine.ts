import { dataPatchSchema, type DataPatch } from "@banorte/contracts";
import type { DataRegistryValue } from "../schemas/data-registry-schema";
import { DataRegistry } from "./DataRegistry.ts";

export interface DataRegistryPatchState {
  revision: number;
  data: DataRegistryValue;
  invalidatedKeys: ReadonlySet<string>;
}

export interface DataRegistryPatchError {
  code: "invalid_patch" | "version_conflict" | "invalid_operation";
  message: string;
}

export type DataRegistryPatchResult =
  | { success: true; state: DataRegistryPatchState }
  | { success: false; state: DataRegistryPatchState; error: DataRegistryPatchError };

export function createDataRegistryPatchState(
  input: unknown = {},
  revision = 0,
): DataRegistryPatchState {
  if (!Number.isInteger(revision) || revision < 0) throw new Error("La revisión de datos no es válida");
  const registry = new DataRegistry(input);
  return { revision, data: { ...registry.snapshot }, invalidatedKeys: new Set() };
}

export function applyDataRegistryPatch(
  state: DataRegistryPatchState,
  input: unknown,
): DataRegistryPatchResult {
  const parsed = dataPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, state, error: { code: "invalid_patch", message: "El cambio de datos no cumple el contrato" } };
  }
  if (parsed.data.baseRevision !== state.revision) {
    return { success: false, state, error: { code: "version_conflict", message: "El cambio parte de una revisión de datos obsoleta" } };
  }

  const hasKey = Object.hasOwn(state.data, parsed.data.key);
  if ((parsed.data.op === "add" && hasKey) || (parsed.data.op !== "add" && !hasKey)) {
    return { success: false, state, error: { code: "invalid_operation", message: "La operación no coincide con el estado del registro" } };
  }

  const data = { ...state.data };
  const invalidatedKeys = new Set(state.invalidatedKeys);
  applyOperation(data, invalidatedKeys, parsed.data);
  const registry = new DataRegistry(data);
  return {
    success: true,
    state: {
      revision: parsed.data.revision,
      data: { ...registry.snapshot },
      invalidatedKeys,
    },
  };
}

function applyOperation(
  data: DataRegistryValue,
  invalidatedKeys: Set<string>,
  patch: DataPatch,
): void {
  if (patch.op === "remove") {
    delete data[patch.key];
    invalidatedKeys.delete(patch.key);
    return;
  }
  if (patch.op === "invalidate") {
    invalidatedKeys.add(patch.key);
    return;
  }
  data[patch.key] = patch.value;
  invalidatedKeys.delete(patch.key);
}
