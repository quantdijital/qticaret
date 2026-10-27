import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { notificationText } from "../notifications/messages"

const PROVIDER_NAMES: Readonly<Record<string, string>> = { paytr: "PayTR", iyzico: "iyzico" }

export type RecoveryAlert = "orphan_recorded" | "orphan_refunded" | "orphan_refund_failed"

/** "210,00 TRY": the amount as the shop reads it. */
const amountText = (kurus: number, currency: string) =>
  `${(kurus / 100).toFixed(2).replace(".", ",")} ${currency.toUpperCase()}`

/**
 * Tells every admin, in the panel's bell, about a payment that became no
 * order: recorded, given back, or left to be given back by hand.
 */
export async function alertRecovery(
  container: MedusaContainer,
  alert: RecoveryAlert,
  recovery: {
    id: string
    provider: string
    reference: string
    amount: number
    currency_code: string
  }
): Promise<void> {
  const provider = PROVIDER_NAMES[recovery.provider] ?? recovery.provider
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: `payments.${alert}`,
    resource_id: recovery.id,
    data: {
      kind: "payment_recovery",
      state: alert,
      provider: recovery.provider,
      reference: recovery.reference,
      amount: recovery.amount,
      currency_code: recovery.currency_code,
      ...notificationText(`payments.${alert}`, {
        provider,
        reference: recovery.reference,
        amount: amountText(recovery.amount, recovery.currency_code),
      }),
    },
  })
}
