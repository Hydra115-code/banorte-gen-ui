import { dataRegistrySchema, type DataRegistryValue } from "../data-binding/schemas/data-registry-schema";

const reservedKeys = new Set(["__proto__", "prototype", "constructor"]);

export function recoverValidData(input: unknown): DataRegistryValue | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;

  const recovered: DataRegistryValue = Object.create(null) as DataRegistryValue;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (reservedKeys.has(key) || !("value" in descriptor)) continue;
    const candidate = dataRegistrySchema.safeParse({ [key]: descriptor.value });
    if (candidate.success) recovered[key] = candidate.data[key]!;
  }

  return Object.keys(recovered).length > 0 ? recovered : null;
}

export function StructuredResultFallback({ data, message }: { data: DataRegistryValue | null; message: string }) {
  const sourceCount = data ? Object.keys(data).length : 0;
  return (
    <section className="ui-degradation ui-degradation--structured" role="alert">
      <p className="ui-renderer-message__title">No pudimos mostrar esta vista</p>
      <p>{message}</p>
      {sourceCount > 0 ? <p>Conservamos {sourceCount} {sourceCount === 1 ? "fuente válida" : "fuentes válidas"} para reintentar sin perder la consulta.</p> : null}
    </section>
  );
}
