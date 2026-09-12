import type { DataValue } from "../schemas/data-registry-schema";

export function readDataField(root: DataValue, field: string): DataValue | undefined {
  let current: DataValue | undefined = root;

  for (const segment of field.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length || !Object.hasOwn(current, index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object" || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}
