import { z } from "zod";

export const MAX_DATA_DEPTH = 32;
export const MAX_DATA_ARRAY_LENGTH = 10_000;
export const MAX_DATA_OBJECT_KEYS = 10_000;
export const MAX_DATA_STRING_LENGTH = 10_000;
export const MAX_DATA_TOTAL_VALUES = 50_000;

export type DataScalar = string | number | boolean | null;
export type DataValue = DataScalar | DataValue[] | { [key: string]: DataValue };
export type DataRegistryValue = { [key: string]: DataValue };

const reservedKeys = new Set(["__proto__", "prototype", "constructor"]);

function isSafeDataValue(root: unknown): root is DataValue {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let totalValues = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    const { value, depth } = current;
    totalValues += 1;
    if (totalValues > MAX_DATA_TOTAL_VALUES) return false;
    if (typeof value === "string" && value.length > MAX_DATA_STRING_LENGTH) return false;
    if (value === null || typeof value === "string" || typeof value === "boolean") continue;
    if (typeof value === "number" && Number.isFinite(value)) continue;
    if (depth >= MAX_DATA_DEPTH || typeof value !== "object") return false;

    if (Array.isArray(value)) {
      if (value.length > MAX_DATA_ARRAY_LENGTH) return false;
      value.forEach((item) => pending.push({ value: item, depth: depth + 1 }));
      continue;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;

    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_DATA_OBJECT_KEYS || keys.some((key) => typeof key !== "string" || reservedKeys.has(key))) {
      return false;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return false;
      pending.push({ value: descriptor.value, depth: depth + 1 });
    }
  }

  return true;
}

export const dataValueSchema = z.custom<DataValue>(isSafeDataValue, {
  message: "El registro solo admite datos JSON planos y seguros",
});

export const dataRegistrySchema = z.custom<DataRegistryValue>(
  (value) => {
    if (!isSafeDataValue(value) || value === null || Array.isArray(value) || typeof value !== "object") {
      return false;
    }

    return true;
  },
  { message: "DataRegistry debe ser un objeto JSON seguro" },
);
