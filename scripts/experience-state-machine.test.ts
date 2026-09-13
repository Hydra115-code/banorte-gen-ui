import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialExperienceState,
  transitionExperience,
  type ExperienceEvent,
  type ExperienceState,
} from "../src/features/workspace/state/experience-state-machine.ts";

function advance(initial: ExperienceState, events: ExperienceEvent[]): ExperienceState {
  return events.reduce((state, event) => {
    const result = transitionExperience(state, event);
    assert.equal(result.accepted, true, `${state.status} debe aceptar ${event.type}`);
    return result.state;
  }, initial);
}

test("completa una generación inicial con dominios separados", () => {
  const state = advance(createInitialExperienceState(), [
    { type: "SUBMIT" },
    { type: "DATA_REQUESTED" },
    { type: "UI_GENERATION_STARTED" },
    { type: "UI_COMMITTED" },
  ]);

  assert.equal(state.status, "ready");
  assert.equal(state.hasValidSnapshot, true);
  assert.deepEqual(state.domains, {
    conversation: "active",
    ui: "stable",
    dataRegistry: "current",
    payment: "idle",
  });
});

test("una cancelación durante una actualización conserva el snapshot válido", () => {
  const ready = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(ready.accepted, true);
  const state = advance(ready.state, [{ type: "SUBMIT" }, { type: "CANCEL", scope: "generation" }]);

  assert.equal(state.status, "cancelled");
  assert.equal(state.hasValidSnapshot, true);
  assert.equal(state.domains.ui, "stable");
  assert.equal(state.domains.dataRegistry, "current");
});

test("generar sobre un snapshot se modela como actualización", () => {
  const restored = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(restored.accepted, true);
  const retrieving = transitionExperience(restored.state, { type: "SUBMIT" });
  assert.equal(retrieving.accepted, true);
  const generating = transitionExperience(retrieving.state, { type: "DATA_REQUESTED" });
  assert.equal(generating.accepted, true);
  const updating = transitionExperience(generating.state, { type: "UI_GENERATION_STARTED" });

  assert.equal(updating.accepted, true);
  assert.equal(updating.state.status, "updating");
  assert.equal(updating.state.domains.ui, "updating");
  assert.equal(updating.state.hasValidSnapshot, true);
});

test("el pago no reutiliza el estado de generación del agente", () => {
  const restored = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(restored.accepted, true);
  const awaiting = transitionExperience(restored.state, { type: "PAYMENT_CONFIRMATION_REQUIRED" });
  assert.equal(awaiting.accepted, true);
  assert.equal(awaiting.state.status, "awaiting_confirmation");
  assert.equal(awaiting.state.domains.ui, "stable");
  assert.equal(awaiting.state.domains.payment, "awaiting_confirmation");

  const executing = transitionExperience(awaiting.state, { type: "PAYMENT_CONFIRMED" });
  assert.equal(executing.accepted, true);
  assert.equal(executing.state.status, "executing_action");
  assert.equal(executing.state.domains.payment, "executing");
});

test("un pago en ejecución no acepta una cancelación tardía", () => {
  const restored = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(restored.accepted, true);
  const awaiting = transitionExperience(restored.state, { type: "PAYMENT_CONFIRMATION_REQUIRED" });
  assert.equal(awaiting.accepted, true);
  const executing = transitionExperience(awaiting.state, { type: "PAYMENT_CONFIRMED" });
  assert.equal(executing.accepted, true);
  const cancelled = transitionExperience(executing.state, { type: "CANCEL", scope: "payment" });

  assert.equal(cancelled.accepted, false);
  assert.equal(cancelled.state.status, "executing_action");
  assert.equal(cancelled.state.domains.payment, "executing");
});

test("un error del agente no convierte el estado del pago en fallido", () => {
  const restored = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(restored.accepted, true);
  const updating = transitionExperience(restored.state, { type: "UI_UPDATE_STARTED" });
  assert.equal(updating.accepted, true);
  const failed = transitionExperience(updating.state, { type: "FAIL", scope: "ui" });

  assert.equal(failed.accepted, true);
  assert.equal(failed.state.status, "error");
  assert.equal(failed.state.domains.ui, "stable");
  assert.equal(failed.state.domains.payment, "idle");
});

test("una captura corregida puede actualizar la UI después de un error conservando el snapshot", () => {
  const ready = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(ready.accepted, true);
  const failed = transitionExperience(ready.state, { type: "FAIL", scope: "ui" });
  assert.equal(failed.accepted, true);
  const updating = transitionExperience(failed.state, { type: "UI_UPDATE_STARTED" });
  assert.equal(updating.accepted, true);
  const committed = transitionExperience(updating.state, { type: "UI_COMMITTED" });
  assert.equal(committed.accepted, true);
  assert.equal(committed.state.status, "ready");
  assert.equal(committed.state.domains.ui, "stable");

  const emptyFailure = transitionExperience(createInitialExperienceState(), { type: "SUBMIT" });
  assert.equal(emptyFailure.accepted, true);
  const withoutSnapshot = transitionExperience(emptyFailure.state, { type: "FAIL", scope: "ui" });
  assert.equal(withoutSnapshot.accepted, true);
  assert.equal(transitionExperience(withoutSnapshot.state, { type: "UI_UPDATE_STARTED" }).accepted, false);
});

test("un conflicto de revisión entra a recuperación de datos", () => {
  const restored = transitionExperience(createInitialExperienceState(), { type: "RESTORE_SESSION" });
  assert.equal(restored.accepted, true);
  const updating = transitionExperience(restored.state, { type: "UI_UPDATE_STARTED" });
  assert.equal(updating.accepted, true);
  const recovery = transitionExperience(updating.state, { type: "REVISION_CONFLICT" });

  assert.equal(recovery.accepted, true);
  assert.equal(recovery.state.status, "retrieving_data");
  assert.equal(recovery.state.hasValidSnapshot, true);
  assert.equal(recovery.state.domains.ui, "stable");
});

test("rechaza transiciones que no pertenecen al estado actual", () => {
  const initial = createInitialExperienceState();
  const result = transitionExperience(initial, { type: "PAYMENT_CONFIRMED" });

  assert.equal(result.accepted, false);
  assert.equal(result.state, initial);
});
