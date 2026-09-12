import type { DataRegistryValue, UISpecification } from "@banorte/contracts";

export const paymentCaptureData: DataRegistryValue = {};

export const paymentCaptureSpecification: UISpecification = {
  version: "1",
  root: {
    type: "container",
    id: "payment-capture-root",
    size: "md",
    padding: "md",
    children: [
      {
        type: "stack",
        id: "payment-capture-stack",
        gap: "md",
        children: [
          { type: "heading", id: "payment-capture-title", content: "Preparar pago", level: 2, size: "title" },
          { type: "badge", id: "payment-capture-badge", label: "Captura", semanticState: "status.info", emphasis: "strong" },
          { type: "alert", id: "payment-capture-safety", title: "Todavía no se realizará el pago", message: "Captura los datos y selecciona Revisar pago. La revisión no mueve dinero ni genera un comprobante.", semanticState: "status.info" },
          { type: "select", id: "payment-source", label: "Cuenta de origen", event: "payment.draft.source_changed", options: [
            { value: "primary", label: "Cuenta principal • 4567" },
            { value: "savings", label: "Ahorro • 9012" },
          ], initialValue: "primary", required: true },
          { type: "select", id: "payment-beneficiary", label: "Beneficiario", event: "payment.draft.beneficiary_changed", options: [
            { value: "ana", label: "Ana Martínez" },
            { value: "electricity", label: "Servicio de electricidad" },
          ], placeholder: "Selecciona un beneficiario", required: true },
          { type: "numberInput", id: "payment-capture-amount", label: "Monto", event: "payment.draft.amount_changed", min: 0.01, max: 1000000, step: 0.01, initialValue: 1250, required: true },
          { type: "input", id: "payment-concept", label: "Concepto", event: "payment.draft.concept_changed", initialValue: "Renta septiembre", validation: { required: true, minLength: 2, maxLength: 80 } },
          { type: "datePicker", id: "payment-capture-date", label: "Fecha de pago", event: "payment.draft.date_changed", initialValue: "2026-09-12", min: "2026-09-12", max: "2027-09-12", required: true },
          { type: "button", id: "payment-review-button", label: "Revisar pago", event: "payment.review.requested", variant: "primary", helpText: "Crea una solicitud de revisión; no confirma ni ejecuta el pago." },
        ],
      },
    ],
  },
};

export const paymentReviewData: DataRegistryValue = {
  accountNumber: "0123456789014567",
  beneficiary: "Ana Martínez",
  amount: 1250,
  currency: "MXN",
  fee: 0,
  paymentDate: "2026-09-12",
  estimatedPostBalance: 41600.75,
};

const reviewMetrics = [
  { type: "metric" as const, id: "payment-review-source", label: "Cuenta de origen", valueBinding: "accountNumber", format: "text" as const, importance: "secondary" as const },
  { type: "metric" as const, id: "payment-review-beneficiary", label: "Beneficiario", valueBinding: "beneficiary", format: "text" as const, importance: "secondary" as const },
  { type: "metric" as const, id: "payment-review-amount", label: "Monto", valueBinding: "amount", format: "currency" as const, importance: "primary" as const },
  { type: "metric" as const, id: "payment-review-currency", label: "Moneda", valueBinding: "currency", format: "text" as const, importance: "secondary" as const },
  { type: "metric" as const, id: "payment-review-fee", label: "Comisión", valueBinding: "fee", format: "currency" as const, importance: "secondary" as const },
  { type: "metric" as const, id: "payment-review-date", label: "Fecha", valueBinding: "paymentDate", format: "date" as const, importance: "secondary" as const },
  { type: "metric" as const, id: "payment-review-balance", label: "Saldo estimado posterior", valueBinding: "estimatedPostBalance", format: "currency" as const, importance: "primary" as const },
];

export const paymentReviewSpecification: UISpecification = {
  version: "1",
  root: {
    type: "container",
    id: "payment-review-root",
    size: "lg",
    padding: "md",
    children: [
      {
        type: "stack",
        id: "payment-review-stack",
        gap: "md",
        children: [
          { type: "heading", id: "payment-review-title", content: "Revisar pago", level: 2, size: "title" },
          { type: "badge", id: "payment-review-badge", label: "Aún no realizado", semanticState: "status.warning", emphasis: "strong" },
          { type: "alert", id: "payment-review-safety", title: "Verifica antes de confirmar", message: "Revisar no ejecuta el pago. La confirmación permanece bloqueada hasta recibir autenticación, idempotencia y resultado autoritativo del backend.", semanticState: "status.warning" },
          { type: "grid", id: "payment-review-details", columns: 3, gap: "md", children: reviewMetrics },
          { type: "button", id: "payment-confirm-button", label: "Confirmar y pagar", event: "payment.confirm.requested", variant: "primary", helpText: "Bloqueado hasta la integración con el contrato autoritativo de pagos." },
          { type: "button", id: "payment-edit-button", label: "Corregir datos", event: "payment.review.edit_requested", variant: "secondary" },
          { type: "button", id: "payment-cancel-button", label: "Cancelar", event: "payment.review.cancel_requested", variant: "ghost", helpText: "Descarta únicamente esta preparación; no cancela pagos realizados o programados." },
        ],
      },
    ],
  },
};

export const paymentRecoverableErrorSpecification: UISpecification = {
  version: "1",
  root: {
    type: "container",
    id: "payment-error-root",
    size: "lg",
    padding: "md",
    children: [
      {
        type: "stack",
        id: "payment-error-stack",
        gap: "md",
        children: [
          { type: "heading", id: "payment-error-title", content: "Corrige el pago", level: 2, size: "title" },
          { type: "alert", id: "payment-error-alert", title: "Saldo insuficiente", message: "Conservamos los datos revisados. Ajusta el monto o cambia la cuenta de origen antes de volver a revisar.", semanticState: "status.error" },
          { type: "grid", id: "payment-error-details", columns: 3, gap: "md", children: reviewMetrics },
          { type: "button", id: "payment-error-edit-button", label: "Corregir monto", event: "payment.review.edit_requested", variant: "primary" },
          { type: "button", id: "payment-error-cancel-button", label: "Cancelar", event: "payment.review.cancel_requested", variant: "ghost" },
        ],
      },
    ],
  },
};

export const paymentPreparationPrompts = [
  "Quiero pagar $1,250 a Ana Martínez.",
  "Revisa el pago antes de realizarlo.",
  "El saldo no alcanza; quiero corregir el monto.",
] as const;
