import { bindingSchema, type Binding, type BindingValueType } from "../schemas/binding-schema";
import type { DataValue } from "../schemas/data-registry-schema";
import { DataRegistry } from "../registry/DataRegistry";
import { formatDataValue } from "../formatting/format-data-value";
import { maskFinancialIdentifier } from "../formatting/mask-financial-identifier";
import { readDataField } from "./read-data-field";

export type BindingResolutionStatus = "resolved" | "missing" | "invalid" | "type_mismatch" | "format_error";

export interface BindingResolution {
  status: BindingResolutionStatus;
  value?: DataValue;
  formattedValue: string | null;
}

export interface BindingResolverOptions {
  locale?: string;
  currency?: string;
}

interface BindingScope {
  item: DataValue;
  index: number;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function matchesExpectedType(value: DataValue, expectedType?: BindingValueType) {
  if (!expectedType) return true;
  if (expectedType === "null") return value === null;
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expectedType === "date") return typeof value === "string" && isoDatePattern.test(value) && !Number.isNaN(Date.parse(value));
  return typeof value === expectedType;
}

export class BindingResolver {
  readonly #registry: DataRegistry;
  readonly #locale: string;
  readonly #currency: string;
  readonly #scope?: BindingScope;

  constructor(registry: DataRegistry, options: BindingResolverOptions = {}, scope?: BindingScope) {
    this.#registry = registry;
    this.#locale = options.locale ?? "es-MX";
    this.#currency = options.currency ?? "MXN";
    this.#scope = scope;
  }

  withScope(item: DataValue, index: number) {
    return new BindingResolver(
      this.#registry,
      { locale: this.#locale, currency: this.#currency },
      { item, index },
    );
  }

  resolve(input: unknown): BindingResolution {
    const parsed = bindingSchema.safeParse(input);
    if (!parsed.success) return { status: "invalid", formattedValue: null };

    const binding: Binding = parsed.data;
    const value = this.#resolveValue(binding.path);
    const formatValue = (candidate: DataValue, format = binding.format) => (
      maskFinancialIdentifier(binding.path, candidate)
      ?? formatDataValue(candidate, format, { locale: this.#locale, currency: this.#currency })
    );

    if (value === undefined) {
      return {
        status: "missing",
        formattedValue: binding.fallback === undefined
          ? null
          : formatValue(binding.fallback, undefined),
      };
    }

    if (!matchesExpectedType(value, binding.expectedType)) {
      return {
        status: "type_mismatch",
        value,
        formattedValue: binding.fallback === undefined
          ? null
          : formatValue(binding.fallback, undefined),
      };
    }

    try {
      return {
        status: "resolved",
        value,
        formattedValue: formatValue(value),
      };
    } catch {
      return {
        status: "format_error",
        value,
        formattedValue: binding.fallback === undefined
          ? null
          : formatValue(binding.fallback, undefined),
      };
    }
  }

  #resolveValue(path: string): DataValue | undefined {
    if (path === "$index") return this.#scope?.index;
    if (path === "$item") return this.#scope?.item;
    if (path.startsWith("$item.")) {
      return this.#scope ? readDataField(this.#scope.item, path.slice(6)) : undefined;
    }
    return readDataField(this.#registry.snapshot, path);
  }
}
