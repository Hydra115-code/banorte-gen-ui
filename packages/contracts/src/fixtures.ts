import {
  paymentConfirmationRequestSchema,
  paymentIntentSchema,
  paymentReceiptSchema,
} from "./financial-domain.js";
import { dataRegistryContractSchema, sessionReferenceSchema, textAgentRequestSchema, textAgentStreamEventSchema, uiEventSchema } from "./protocol.js";
import { uiPatchSchema } from "./generative-ui/patches/ui-patch-schema.js";
import { uiSpecificationSchema } from "./generative-ui/schemas/ui-specification.js";

const sessionId = "10000000-0000-4000-8000-000000000001";
const correlationId = "20000000-0000-4000-8000-000000000001";

export const simpleSessionFixture = sessionReferenceSchema.parse({
  interfaceRevision: 0,
  dataRevision: 0,
  dataKeys: [],
});

export const financialQueryFixture = textAgentRequestSchema.parse({
  version: "1",
  sessionId,
  correlationId,
  provider: "google",
  responseMode: "complete-ui",
  query: "¿Cuánto dinero tengo disponible?",
  sessionState: simpleSessionFixture,
});

export const initialUIFixture = uiSpecificationSchema.parse({
  version: "1",
  root: {
    type: "section",
    id: "accounts-summary",
    ariaLabel: "Resumen de cuentas",
    children: [
      { type: "heading", id: "summary-title", content: "Tu dinero disponible", level: 2 },
      {
        type: "metric",
        id: "available-balance",
        label: "Saldo disponible",
        valueBinding: "accounts.0.balance",
        format: "currency",
        importance: "primary",
      },
      {
        type: "button",
        id: "view-transactions",
        label: "Ver movimientos",
        event: "transactions.view",
        variant: "secondary",
      },
    ],
  },
});

export const initialDataRegistryFixture = dataRegistryContractSchema.parse({
  version: "1",
  revision: 0,
  data: {
    accounts: [{
      id: "40000000-0000-4000-8000-000000000001",
      name: "Cuenta Nómina Principal",
      type: "checking",
      status: "active",
      balance: "38742.65",
      currency: "MXN",
      maskedIdentifier: "****0527",
    }],
  },
});

export const streamFixture = [
  textAgentStreamEventSchema.parse({
    version: "1", sessionId, correlationId, sequence: 1, type: "started",
  }),
  textAgentStreamEventSchema.parse({
    version: "1", sessionId, correlationId, sequence: 2, type: "status",
    status: { version: "1", stage: "retrieving_data", message: "Consultando tus cuentas" },
  }),
  textAgentStreamEventSchema.parse({
    version: "1", sessionId, correlationId, sequence: 3, type: "ui",
    specification: initialUIFixture,
    dataRegistry: initialDataRegistryFixture,
  }),
  textAgentStreamEventSchema.parse({
    version: "1", sessionId, correlationId, sequence: 4, type: "completed",
  }),
];

export const uiPatchFixture = uiPatchSchema.parse({
  version: "1",
  baseRevision: 0,
  revision: 1,
  op: "update",
  target: "summary-title",
  changes: { content: "Saldo actualizado" },
});

export const interactionFixture = uiEventSchema.parse({
  version: "1",
  correlationId,
  sessionId,
  interfaceRevision: 0,
  dataRevision: 0,
  dataKeys: ["accounts"],
  event: { name: "transactions.view", sourceId: "view-transactions" },
});

export const paymentPreparationFixture = paymentIntentSchema.parse({
  id: "50000000-0000-4000-8000-000000000001",
  sourceAccountId: "40000000-0000-4000-8000-000000000001",
  beneficiaryId: "60000000-0000-4000-8000-000000000001",
  amount: "850.00",
  currency: "MXN",
  concept: "Pago de servicios",
  fee: "0.00",
  estimatedBalanceAfter: "37892.65",
  status: "awaiting_confirmation",
  idempotencyKey: "70000000-0000-4000-8000-000000000001",
  expiresAt: "2026-09-12T06:10:00.000Z",
});

export const paymentConfirmationFixture = paymentConfirmationRequestSchema.parse({
  paymentIntentId: paymentPreparationFixture.id,
  correlationId,
  confirmed: true,
});

export const paymentReceiptFixture = paymentReceiptSchema.parse({
  paymentId: "80000000-0000-4000-8000-000000000001",
  paymentIntentId: paymentPreparationFixture.id,
  status: "succeeded",
  receiptNumber: "MOC-5000000000004000",
  amount: "850.00",
  currency: "MXN",
  fee: "0.00",
  balanceBefore: "38742.65",
  balanceAfter: "37892.65",
  executedAt: "2026-09-12T06:02:00.000Z",
});
