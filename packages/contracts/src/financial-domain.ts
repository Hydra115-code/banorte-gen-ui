import { z } from "zod";

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, "La moneda debe usar ISO 4217");
export const financialAmountSchema = z.string().regex(
  /^-?\d{1,16}(?:\.\d{1,2})?$/,
  "El importe debe ser un decimal serializado con máximo dos decimales",
);
export const positiveFinancialAmountSchema = financialAmountSchema.refine(
  (amount) => Number(amount) > 0,
  "El importe debe ser positivo",
);

export const accountTypeSchema = z.enum(["checking", "savings", "credit_card"]);
export const accountStatusSchema = z.enum(["active", "blocked", "closed"]);
export const accountSchema = z.object({
  id: z.string().uuid(),
  type: accountTypeSchema,
  status: accountStatusSchema,
  name: z.string().trim().min(1).max(100),
  currency: currencySchema,
  balance: financialAmountSchema,
  maskedIdentifier: z.string().regex(/^\*{4,}\d{4}$/).nullable(),
}).strict();

export const transactionTypeSchema = z.enum(["income", "expense", "transfer", "payment"]);
export const financialCategorySchema = z.enum([
  "income",
  "housing",
  "transport",
  "groceries",
  "restaurants",
  "entertainment",
  "health",
  "education",
  "subscriptions",
  "transfers",
  "other",
]);
export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: transactionTypeSchema,
  amount: positiveFinancialAmountSchema,
  currency: currencySchema,
  description: z.string().trim().min(1).max(255),
  category: financialCategorySchema,
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

const financialPeriodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export const financialSummarySchema = z.object({
  period: financialPeriodSchema,
  summaries: z.array(z.object({
    currency: currencySchema,
    totalIncome: financialAmountSchema,
    totalExpenses: financialAmountSchema,
    netCashFlow: financialAmountSchema,
    savingsRate: financialAmountSchema.nullable(),
    transactionCount: z.number().int().nonnegative(),
    largestExpense: financialAmountSchema.nullable(),
    largestIncome: financialAmountSchema.nullable(),
  }).strict()),
}).strict();

export const financialHealthStatusSchema = z.enum([
  "healthy",
  "attention",
  "critical",
  "insufficient_data",
]);
export const financialHealthSchema = z.object({
  currency: currencySchema,
  score: z.number().int().min(0).max(100),
  status: financialHealthStatusSchema,
  totalLiquidBalance: financialAmountSchema,
  netCashFlow: financialAmountSchema,
  savingsRate: financialAmountSchema.nullable(),
  evaluatedAt: z.string().datetime({ offset: true }),
}).strict();

export const paymentStatusSchema = z.enum([
  "draft",
  "awaiting_confirmation",
  "executing",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
]);

export const paymentIntentSchema = z.object({
  id: z.string().uuid(),
  sourceAccountId: z.string().uuid(),
  beneficiaryId: z.string().uuid(),
  amount: positiveFinancialAmountSchema,
  currency: currencySchema,
  concept: z.string().trim().max(140).nullable(),
  fee: financialAmountSchema.refine((amount) => Number(amount) >= 0, "La comisión no puede ser negativa"),
  estimatedBalanceAfter: financialAmountSchema,
  status: paymentStatusSchema,
  idempotencyKey: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

export const paymentConfirmationRequestSchema = z.object({
  paymentIntentId: z.string().uuid(),
  correlationId: z.string().uuid(),
  confirmed: z.literal(true),
}).strict();

export const paymentReceiptSchema = z.object({
  paymentId: z.string().uuid(),
  paymentIntentId: z.string().uuid(),
  status: z.enum(["succeeded", "failed"]),
  receiptNumber: z.string().trim().min(1).max(80),
  amount: positiveFinancialAmountSchema,
  currency: currencySchema,
  fee: financialAmountSchema.refine((amount) => Number(amount) >= 0, "La comisión no puede ser negativa"),
  balanceBefore: financialAmountSchema,
  balanceAfter: financialAmountSchema,
  executedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export type Currency = z.infer<typeof currencySchema>;
export type FinancialAmount = z.infer<typeof financialAmountSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type Account = z.infer<typeof accountSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type FinancialCategory = z.infer<typeof financialCategorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type FinancialSummary = z.infer<typeof financialSummarySchema>;
export type FinancialHealthStatus = z.infer<typeof financialHealthStatusSchema>;
export type FinancialHealth = z.infer<typeof financialHealthSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type PaymentConfirmationRequest = z.infer<typeof paymentConfirmationRequestSchema>;
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
