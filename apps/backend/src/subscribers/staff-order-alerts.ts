import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../lib/money"
import type { MedusaAmount } from "../lib/money"
import { notificationText } from "../lib/notifications/messages"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../lib/payments/checkout"
import { alertStaff } from "../workflows/messaging/staff"

interface OrderRow {
  display_id: number
  total: MedusaAmount
  payment_collections?:
    ({ payment_sessions?: ({ provider_id: string } | null)[] | null } | null)[] | null
}

/**
 * The shop hears of a new order (F9.7): by e-mail to its staff list, and
 * one paid by bank transfer also in the panel's bell, since the shop has
 * to confirm the money when it comes.
 */
export default async function staffOrderAlerts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["display_id", "total", "payment_collections.payment_sessions.provider_id"],
    filters: { id: data.id },
  })
  const order = orders[0] as OrderRow | undefined
  if (!order) {
    return
  }
  await alertStaff(container, { template: "staff.new_order", resource_id: data.id })
  const transfer = (order.payment_collections ?? []).some((collection) =>
    (collection?.payment_sessions ?? []).some(
      (session) => session?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID
    )
  )
  if (!transfer) {
    return
  }
  const number = String(order.display_id)
  const total = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    fromMedusaAmount(order.total, { allowRounding: true }) / 100
  )
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: "orders.bank_transfer_pending",
    resource_id: data.id,
    resource_type: "order",
    idempotency_key: `orders.bank_transfer_pending:${data.id}`,
    data: {
      kind: "bank_transfer_pending",
      order_id: data.id,
      number,
      ...notificationText("orders.bank_transfer_pending", { number, total }),
    },
  })
  await alertStaff(container, { template: "staff.bank_transfer", resource_id: data.id })
}

export const config: SubscriberConfig = { event: "order.placed" }
