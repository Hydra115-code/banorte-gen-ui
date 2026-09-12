import {
  dataRegistrySchema,
  type DataRegistryValue,
  type DataValue,
} from "../schemas/data-registry-schema";

function cloneAndFreeze(value: DataValue): DataValue {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneAndFreeze)) as DataValue[];
  }

  const clone: { [key: string]: DataValue } = Object.create(null) as { [key: string]: DataValue };
  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor && "value" in descriptor) clone[key] = cloneAndFreeze(descriptor.value as DataValue);
  }

  return Object.freeze(clone);
}

export class DataRegistry {
  readonly #data: Readonly<DataRegistryValue>;

  constructor(input: unknown) {
    const parsed = dataRegistrySchema.parse(input);
    this.#data = cloneAndFreeze(parsed) as Readonly<DataRegistryValue>;
  }

  get snapshot(): Readonly<DataRegistryValue> {
    return this.#data;
  }
}
