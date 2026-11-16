import { MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { PaymentRecovery } from "./models/payment-recovery"

// Tries before a refund is left to the shop (the job runs every few minutes)
export const MAX_REFUND_ATTEMPTS = 10

/** The statuses of a payment being, or left to be, given back: every one but `order_exists`. */
export const GIVEN_BACK = ["pending", "refunded", "failed"] as const

export interface RecoveryInput {
  provider: string
  reference: string
  amount: number
  currency_code: string
  test_mode: boolean
  reason: "session_gone" | "amount_mismatch" | "completion_failed"
  cart_id?: string | null
}

/** Payments to give back, each recorded once (adr/0026 §6). */
class PaymentRecoveryModuleService extends MedusaService({ PaymentRecovery }) {
  /** Records a payment to give back; a repeat of the same one is not recorded twice. */
  async recordOrphan(input: RecoveryInput): Promise<{ id: string; created: boolean }> {
    try {
      const created = await this.createPaymentRecoveries({
        ...input,
        cart_id: input.cart_id ?? null,
        // Letters and digits only, as PayTR takes a refund's reference
        refund_reference: `R${input.reference}`.replace(/[^A-Za-z0-9]/g, "").slice(0, 64),
      })
      return { id: created.id, created: true }
    } catch (error) {
      if (!uniqueViolationKeys(error)) {
        throw error
      }
    }
    const [existing] = await this.listPaymentRecoveries(
      { provider: input.provider, reference: input.reference },
      { take: 1 }
    )
    if (!existing) {
      throw new Error(`payment recovery ${input.provider}:${input.reference} vanished`)
    }
    return { id: existing.id, created: false }
  }

  async markRefunded(id: string): Promise<void> {
    await this.updatePaymentRecoveries({
      id,
      status: "refunded",
      refunded_at: new Date(),
      error_code: null,
    })
  }

  /**
   * The payment belongs to a placed order after all (finding 2026-11-16):
   * never given back; out of the job's queue for good, the shop told.
   */
  async markOrderExists(id: string): Promise<void> {
    await this.updatePaymentRecoveries({ id, status: "order_exists", error_code: "order_exists" })
  }

  /** One more try that did not give the money back; past the limit it is the shop's to do. */
  async markAttempt(
    id: string,
    attempts: number,
    errorCode: string
  ): Promise<"pending" | "failed"> {
    const status = attempts + 1 >= MAX_REFUND_ATTEMPTS ? "failed" : "pending"
    await this.updatePaymentRecoveries({
      id,
      attempts: attempts + 1,
      error_code: errorCode,
      status,
    })
    return status
  }
}

export default PaymentRecoveryModuleService
