import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../../lib/dashboard"
import type { StateOrder } from "../../../../lib/dashboard"
import { MAX_ORDERS_READ, NOT_ORDERS } from "../../dashboard/orders"

interface OptionOrder extends StateOrder {
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

/**
 * Whether orders still to ship chose this option (security review
 * 2026-10-28): without it Medusa cannot pack their parcels, so deleting
 * it is refused until they are on their way. Read like the order board:
 * the latest orders, as many as it reads (Medusa filters no order by its
 * shipping option).
 */
export async function optionInUse(container: MedusaContainer, optionId: string): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [...LIFECYCLE_FIELDS, ...ORDER_STATE_FIELDS, "shipping_methods.shipping_option_id"],
    filters: { status: { $nin: [...NOT_ORDERS, "canceled"] }, is_draft_order: false },
    pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "DESC" } },
  })
  return (data as OptionOrder[]).some(
    (order) =>
      (order.shipping_methods ?? []).some((method) => method?.shipping_option_id === optionId) &&
      (orderState(order).ship?.items.length ?? 0) > 0
  )
}
