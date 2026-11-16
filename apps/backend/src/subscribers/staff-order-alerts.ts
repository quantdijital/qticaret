import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../lib/payments/checkout"
import { alertStaff } from "../workflows/messaging/staff"

interface OrderRow {
  payment_collections?:
    ({ payment_sessions?: ({ provider_id: string } | null)[] | null } | null)[] | null
}

/**
 * The shop hears of a new order by e-mail to its staff list (F9.7), and
 * of one paid by bank transfer again, since the shop has to confirm the
 * money when it comes. The panel's bell rings from the order's stamp
 * (`wholesale-order-stamp.ts`), which knows whether it is wholesale.
 */
export default async function staffOrderAlerts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "payment_collections.payment_sessions.provider_id"],
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
  if (transfer) {
    await alertStaff(container, { template: "staff.bank_transfer", resource_id: data.id })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
