import type { InteractionNode } from "../../schemas/interaction-node.js";

/**
 * Changes only when retaining local control state could contradict the new
 * contract. Cosmetic label/help/event changes deliberately keep the same key.
 */
export function controlCompatibilityKey(node: InteractionNode): string {
  switch (node.type) {
    case "button":
      return `${node.type}:${node.id}`;
    case "input":
      return JSON.stringify([node.type, node.id, node.initialValue, node.validation]);
    case "numberInput":
      return JSON.stringify([node.type, node.id, node.initialValue, node.min, node.max, node.step, node.required]);
    case "select":
      return JSON.stringify([node.type, node.id, node.initialValue, node.required, node.options]);
    case "multiSelect":
      return JSON.stringify([node.type, node.id, node.initialValue, node.minSelections, node.maxSelections, node.options]);
    case "slider":
      return JSON.stringify([node.type, node.id, node.initialValue, node.min, node.max, node.step]);
    case "datePicker":
      return JSON.stringify([node.type, node.id, node.initialValue, node.min, node.max, node.required]);
    case "dateRange":
      return JSON.stringify([node.type, node.id, node.initialValue, node.min, node.max, node.required]);
    case "checkbox":
      return JSON.stringify([node.type, node.id, node.initialChecked, node.required]);
    case "switch":
      return JSON.stringify([node.type, node.id, node.initialChecked]);
    case "radioGroup":
      return JSON.stringify([node.type, node.id, node.initialValue, node.required, node.options]);
  }
}
