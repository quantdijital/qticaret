import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  LIFECYCLE_FIELDS,
  boardSlice,
  fulfillmentStatusOf,
  paymentStatusOf,
} from "../../../lib/dashboard"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { fromMedusaAmount, toMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { MAX_ORDERS_READ, NOT_ORDERS } from "../dashboard/orders"
import { ORDER_BOARD_PAGE } from "./validators"
import type { AdminGetOrderBoardType } from "./validators"

interface StageRow extends LifecycleOrder {
  id: string
}

interface DisplayRow extends LifecycleOrder {
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

const customerOf = (address: DisplayRow["shipping_address"]) => ({
  name: [address?.first_name, address?.last_name].filter(Boolean).join(" ") || null,
  place: address?.province ?? address?.city ?? null,
})

/**
 * The order list by stage (adr/0022). Stages come from payment and
 * shipment records the database cannot filter on, so the newest
 * MAX_ORDERS_READ orders are sorted here (`limited` says when there were
 * more); only the page's orders are then read in full.
 */
export async function readOrderBoard(scope: MedusaContainer, params: AdminGetOrderBoardType) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters = {
    status: { $nin: NOT_ORDERS },
    is_draft_order: false,
    ...(params.q ? { q: params.q } : {}),
  }
  const { data, metadata } = await query.graph({
    entity: "order",
    fields: ["id", ...LIFECYCLE_FIELDS],
    filters,
    pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "DESC" } },
  })
  const rows = data as unknown as StageRow[]
  const slice = boardSlice(rows, params.stage, params.offset, ORDER_BOARD_PAGE)
  const ids = slice.page.map((row) => row.id)
  const { data: full } = ids.length
    ? await query.graph({
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
        filters: { id: ids },
      })
    : { data: [] }
  const byId = new Map((full as unknown as DisplayRow[]).map((order) => [order.id, order]))
  return {
    orders: slice.page.flatMap(({ id, stage }) => {
      const order = byId.get(id)
      return order
        ? [
            {
              id,
              display_id: Number(order.display_id),
              created_at: new Date(order.created_at).toISOString(),
              currency_code: order.currency_code,
              total: toMedusaAmount(fromMedusaAmount(order.total, { allowRounding: true })),
              items: (order.items ?? []).reduce((sum, item) => sum + (item?.quantity ?? 0), 0),
              stage,
              payment_status: paymentStatusOf(order),
              fulfillment_status: fulfillmentStatusOf(order),
              customer: customerOf(order.shipping_address),
            },
          ]
        : []
    }),
    count: slice.count,
    counts: slice.counts,
    offset: params.offset,
    limit: ORDER_BOARD_PAGE,
    limited: (metadata?.count ?? rows.length) > rows.length,
  }
}

export type OrderBoard = Awaited<ReturnType<typeof readOrderBoard>>
