import { MedusaService } from "@medusajs/framework/utils"
import { PaymentForm } from "./models/payment-form"

export interface FormInput {
  provider: string
  session_id: string
  cart_id: string
  token: string
  expires_at: Date
}

/** Hosted forms given out, kept open until their result is known (F5 V9). */
class PaymentFormsModuleService extends MedusaService({ PaymentForm }) {
  async record(input: FormInput): Promise<void> {
    await this.createPaymentForms({ ...input, status: "open" })
  }

  async close(sessionId: string, outcome: string): Promise<void> {
    const [form] = await this.listPaymentForms(
      { session_id: sessionId, status: "open" },
      { take: 1 }
    )
    if (form) {
      await this.updatePaymentForms({ id: form.id, status: "closed", outcome })
    }
  }
}

export default PaymentFormsModuleService
