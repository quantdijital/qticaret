import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf } from "../../../../lib/dashboard"
import type { LifecycleOrder } from "../../../../lib/dashboard"
import { fromMedusaAmount, toMedusaAmount } from "../../../../lib/money"
import type { MedusaAmount } from "../../../../lib/money"
import { NOT_ORDERS } from "../orders"

const LIMIT = 8

interface OrderRow extends LifecycleOrder {
  id: string
  display_id: number | string
  created_at: string | Date
  total: MedusaAmount
  items?: ({ quantity?: number | null } | null)[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    city?: string | null
    province?: string | null
  } | null
}

// The name on the parcel, and where it goes: il, or ilçe without one
const customerOf = (address: OrderRow["shipping_address"]) => ({
  name: [address?.first_name, address?.last_name].filter(Boolean).join(" ") || null,
  place: address?.province ?? address?.city ?? null,
})

/**
 * The newest orders with the customer's name and province. Personal data:
 * the route is a recorded read (adr/0011), like Medusa's order list.
 */
export async function readRecentOrders(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "total",
      ...LIFECYCLE_FIELDS,
      "items.quantity",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.city",
      "shipping_address.province",
    ],
    filters: { status: { $nin: NOT_ORDERS }, is_draft_order: false },
    pagination: { skip: 0, take: LIMIT, order: { created_at: "DESC" } },
  })
  return {
    orders: (data as unknown as OrderRow[]).map((order) => ({
      id: order.id,
      display_id: Number(order.display_id),
      created_at: new Date(order.created_at).toISOString(),
      currency_code: order.currency_code,
      total: toMedusaAmount(fromMedusaAmount(order.total, { allowRounding: true })),
      items: (order.items ?? []).reduce((sum, item) => sum + (item?.quantity ?? 0), 0),
      stage: lifecycleOf(order),
      customer: customerOf(order.shipping_address),
    })),
  }
}
