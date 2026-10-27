import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { IYZICO_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { PAYMENT_FORMS_MODULE } from "../../../modules/payment-forms"
import type PaymentFormsModuleService from "../../../modules/payment-forms/service"

// Providers whose result reaches us only through the shopper's browser (iyzico, no webhook), by name
const RECONCILED_FROM_FORMS: Readonly<Record<string, string>> = {
  [IYZICO_PAYMENT_PROVIDER_ID]: "iyzico",
}

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
    const provider = RECONCILED_FROM_FORMS[input.provider_id]
    if (!provider || typeof token !== "string" || typeof expiresAt !== "string") {
      return new StepResponse(null)
    }
    await container.resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE).record({
      provider,
      session_id: input.session_id,
      cart_id: input.cart_id,
      token,
      expires_at: new Date(expiresAt),
    })
    return new StepResponse(null)
  }
)
