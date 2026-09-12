import { dataRegistrySchema, sessionReferenceSchema, uiSpecificationSchema } from "@banorte/contracts";
import { z } from "zod";
import { createUIPatchState } from "../../generative-ui/patches/ui-patch-engine.ts";
import { createDataRegistryPatchState } from "../../generative-ui/data-binding/registry/data-registry-patch-engine.ts";

export const sessionUiSnapshotSchema = sessionReferenceSchema.extend({
  version: z.literal("1"), sessionId: z.string().uuid(),
  specification: uiSpecificationSchema, data: dataRegistrySchema,
  invalidatedKeys: z.array(z.string().min(1).max(64)).max(20),
}).strict().superRefine((snapshot, context) => {
  if (JSON.stringify(Object.keys(snapshot.data).sort()) !== JSON.stringify([...snapshot.dataKeys].sort())
    || snapshot.invalidatedKeys.some((key) => !Object.hasOwn(snapshot.data, key))) {
    context.addIssue({ code: "custom", message: "Snapshot de datos incompleto" });
  }
});

export function restoreSessionUiSnapshot(input: unknown, expectedSessionId: string) {
  const snapshot = sessionUiSnapshotSchema.parse(input);
  if (snapshot.sessionId !== expectedSessionId) throw new Error("Identidad de snapshot inválida");
  const ui = createUIPatchState(snapshot.specification, snapshot.interfaceRevision);
  if (!ui.success) throw new Error("UI de snapshot inválida");
  const data = createDataRegistryPatchState(snapshot.data, snapshot.dataRevision);
  return { ui: ui.state, data: { ...data, invalidatedKeys: new Set(snapshot.invalidatedKeys) } };
}
