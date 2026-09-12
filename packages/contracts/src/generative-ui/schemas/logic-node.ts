import { z } from "zod";
import { bindingReferenceSchema } from "../data-binding/schemas/binding-schema.js";
import { optionalNodeIdField, type IdentifiableNode } from "./node-id.js";

export const MAX_REPEAT_ITERATIONS = 100;
export const MAX_LOGIC_NESTING = 4;

export const conditionOperatorSchema = z.enum([
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "contains",
  "exists",
  "notExists",
]);

const conditionValueSchema = z.union([
  z.string().max(300),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const logicConditionSchema = z.object({
  binding: bindingReferenceSchema,
  operator: conditionOperatorSchema,
  value: conditionValueSchema.optional(),
}).strict().superRefine((condition, context) => {
  const isExistenceOperator = condition.operator === "exists" || condition.operator === "notExists";

  if (isExistenceOperator && condition.value !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Los operadores de existencia no aceptan value",
    });
  }

  if (!isExistenceOperator && condition.value === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "El operador requiere un value",
    });
  }
});

export type LogicCondition = z.infer<typeof logicConditionSchema>;

export interface RepeatNode<TNode = unknown> extends IdentifiableNode {
  type: "repeat";
  dataBinding: string;
  template: TNode;
  empty?: TNode;
}

export interface ConditionalNode<TNode = unknown> extends IdentifiableNode {
  type: "conditional";
  condition: LogicCondition;
  then: TNode;
  else?: TNode;
}

export type LogicNode<TNode = unknown> = RepeatNode<TNode> | ConditionalNode<TNode>;

export function createRepeatNodeSchema<TNode>(nodeSchema: z.ZodType<TNode>) {
  return z.object({
    type: z.literal("repeat"),
    ...optionalNodeIdField,
    dataBinding: bindingReferenceSchema,
    template: nodeSchema,
    empty: nodeSchema.optional(),
  }).strict();
}

export function createConditionalNodeSchema<TNode>(nodeSchema: z.ZodType<TNode>) {
  return z.object({
    type: z.literal("conditional"),
    ...optionalNodeIdField,
    condition: logicConditionSchema,
    then: nodeSchema,
    else: nodeSchema.optional(),
  }).strict();
}
