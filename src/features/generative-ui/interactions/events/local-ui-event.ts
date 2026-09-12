import { z } from "zod";
import { interactionEventNameSchema, interactionIdSchema } from "../../schemas/interaction-node";

export const interactionValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(80)).max(100),
  z.object({ start: z.string().max(10), end: z.string().max(10) }).strict(),
  z.null(),
]);

export const localUIEventSchema = z.object({
  name: interactionEventNameSchema,
  sourceId: interactionIdSchema,
  value: interactionValueSchema.optional(),
  isValid: z.boolean(),
}).strict();

export type LocalUIEvent = z.infer<typeof localUIEventSchema>;
export type InteractionValue = z.infer<typeof interactionValueSchema>;
export type LocalUIEventListener = (event: LocalUIEvent) => void;

export class LocalUIEventBus {
  readonly #listeners = new Set<LocalUIEventListener>();

  dispatch(input: unknown) {
    const result = localUIEventSchema.safeParse(input);
    if (!result.success) return false;

    this.#listeners.forEach((listener) => listener(result.data));
    return true;
  }

  subscribe(listener: LocalUIEventListener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
