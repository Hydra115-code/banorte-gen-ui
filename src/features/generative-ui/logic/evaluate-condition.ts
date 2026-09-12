import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { LogicCondition } from "../schemas/logic-node";

function isComparableScalar(value: DataValue | undefined): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function evaluateCondition(condition: LogicCondition, value: DataValue | undefined) {
  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null;
    case "notExists":
      return value === undefined || value === null;
    case "==":
      return isComparableScalar(value) && Object.is(value, condition.value);
    case "!=":
      return isComparableScalar(value) && !Object.is(value, condition.value);
    case "<":
      return typeof value === "number" && typeof condition.value === "number" && value < condition.value;
    case "<=":
      return typeof value === "number" && typeof condition.value === "number" && value <= condition.value;
    case ">":
      return typeof value === "number" && typeof condition.value === "number" && value > condition.value;
    case ">=":
      return typeof value === "number" && typeof condition.value === "number" && value >= condition.value;
    case "contains":
      if (typeof value === "string" && typeof condition.value === "string") {
        return value.includes(condition.value);
      }
      return Array.isArray(value) && value.some((item) => isComparableScalar(item) && Object.is(item, condition.value));
  }
}
