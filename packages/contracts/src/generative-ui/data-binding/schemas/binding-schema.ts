import { z } from "zod";

const reservedPathSegments = new Set(["__proto__", "prototype", "constructor"]);
const pathPattern = /^(?:(?:[a-zA-Z_][a-zA-Z0-9_]*|\$item)(\.(?:[a-zA-Z_][a-zA-Z0-9_]*|0|[1-9][0-9]{0,5}))*|\$index)$/;

export const bindingReferenceSchema = z.string()
  .min(1)
  .max(160)
  .regex(pathPattern)
  .refine(
    (path) => !path.split(".").some((segment) => reservedPathSegments.has(segment)),
    "La referencia contiene un segmento reservado",
  );

export function isScopedBindingReference(path: string) {
  return path === "$item" || path.startsWith("$item.") || path === "$index";
}

export const bindingFormatSchema = z.enum(["currency", "number", "percent", "date", "text"]);
export const bindingValueTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "object",
  "null",
]);
export const bindingFallbackSchema = z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]);

export const bindingSchema = z.object({
  path: bindingReferenceSchema,
  format: bindingFormatSchema.optional(),
  expectedType: bindingValueTypeSchema.optional(),
  fallback: bindingFallbackSchema.optional(),
}).strict();

export type Binding = z.infer<typeof bindingSchema>;
export type BindingFormat = z.infer<typeof bindingFormatSchema>;
export type BindingValueType = z.infer<typeof bindingValueTypeSchema>;
export type BindingFallback = z.infer<typeof bindingFallbackSchema>;
