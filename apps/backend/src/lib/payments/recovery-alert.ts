import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { notificationText } from "../notifications/messages"

const PROVIDER_NAMES: Readonly<Record<string, string>> = { paytr: "PayTR", iyzico: "iyzico" }

export type RecoveryAlert =
  "orphan_recorded" | "orphan_refunded" | "orphan_refund_failed" | "orphan_order_exists"

/** "210,00 TRY": the amount as the shop reads it. */
const amountText = (kurus: number, currency: string) =>
  `${(kurus / 100).toFixed(2).replace(".", ",")} ${currency.toUpperCase()}`

/**
 * Tells every admin, in the panel's bell, about a payment that became no
 * order: recorded, given back, or left to be given back by hand; or one
 * recorded so that belongs to a placed order after all, not given back
 * (`orphan_order_exists`, finding 2026-11-16; ids only).
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
    /** The placed order the payment belongs to, when one was found. */
    order_id?: string | null
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
      ...(recovery.order_id ? { order_id: recovery.order_id } : {}),
      ...notificationText(`payments.${alert}`, {
        provider,
        reference: recovery.reference,
        amount: amountText(recovery.amount, recovery.currency_code),
        order: recovery.order_id ?? "—",
      }),
    },
  })
}
