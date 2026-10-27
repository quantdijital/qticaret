import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { IYZICO_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { PAYMENT_FORMS_MODULE } from "../../../modules/payment-forms"
import type PaymentFormsModuleService from "../../../modules/payment-forms/service"

// Providers whose result reaches us only through the shopper's browser (iyzico, no webhook)
const RECONCILED_FROM_FORMS: readonly string[] = [IYZICO_PAYMENT_PROVIDER_ID]

/**
 * Records the form just given out (`payment-forms`), so the reconcile job
 * asks about it even after a new start deletes its session. PayTR needs
 * none: it notifies the shop itself and tries again until answered.
 */
export const recordPaymentFormStep = createStep(
  "payments-record-payment-form",
  async (
    input: {
      provider_id: string
      session_id: string
      cart_id: string
      data: Record<string, unknown>
    },
    { container }
  ) => {
    const { token, expires_at: expiresAt } = input.data
    if (
      !RECONCILED_FROM_FORMS.includes(input.provider_id) ||
      typeof token !== "string" ||
      typeof expiresAt !== "string"
    ) {
      return new StepResponse(null)
    }
    await container.resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE).record({
      provider: "iyzico",
      session_id: input.session_id,
      cart_id: input.cart_id,
      token,
      expires_at: new Date(expiresAt),
    })
    return new StepResponse(null)
  }
)
