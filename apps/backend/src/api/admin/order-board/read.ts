import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, boardSlice } from "../../../lib/dashboard"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { lineAddonsOf } from "../../../lib/catalog/addons"
import { LINE_METADATA_FIELDS, lineMetadataOf } from "../../../lib/orders/line-metadata"
import type { LineMetadataRow } from "../../../lib/orders/line-metadata"
import { fromMedusaAmount, toMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { deliveriesOf, shippingOf } from "./parcels"
import type { ShippingMethodRow } from "./parcels"
import { boardRows } from "./rows"
import { ORDER_BOARD_PAGE } from "./validators"
import type { AdminGetOrderBoardType } from "./validators"

interface DisplayRow extends LifecycleOrder {
  id: string
  display_id: number | string
  created_at: string | Date
  total: MedusaAmount
  items?: ((LineMetadataRow & { quantity?: number | null }) | null)[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    city?: string | null
    province?: string | null
  } | null
  shipping_methods?: (ShippingMethodRow | null)[] | null
}

const customerOf = (address: DisplayRow["shipping_address"]) => ({
  name: [address?.first_name, address?.last_name].filter(Boolean).join(" ") || null,
  place: address?.province ?? address?.city ?? null,
})

/**
 * The order's lines made to the buyer's wish (adr/0052 §9): how many carry
 * add-ons and whether one puts a line outside the right of withdrawal, for
 * the list's badge; the texts themselves are the order page's and the
 * packing slip's.
 */
function addonsOf(items: DisplayRow["items"]) {
  const lines = (items ?? []).flatMap((item) => {
    const addons = lineAddonsOf(lineMetadataOf(item))
    return addons && addons.items.length > 0 ? [addons] : []
  })
  return {
    lines: lines.length,
    non_withdrawable: lines.some((addons) => addons.non_withdrawable),
  }
}

/**
 * The order list by stage (adr/0022): the filters' orders sorted into
 * stages (`rows.ts`), and only the page's orders read in full.
 */
export async function readOrderBoard(scope: MedusaContainer, params: AdminGetOrderBoardType) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { offset, ...filters } = params
  const { rows, limited } = await boardRows(scope, filters)
  const slice = boardSlice(rows, params.stage, offset, ORDER_BOARD_PAGE)
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
          ...LINE_METADATA_FIELDS,
          "shipping_address.first_name",
          "shipping_address.last_name",
          "shipping_address.city",
          "shipping_address.province",
          "shipping_methods.name",
          "shipping_methods.shipping_option_id",
        ],
        filters: { id: ids },
      })
    : { data: [] }
  const byId = new Map((full as unknown as DisplayRow[]).map((order) => [order.id, order]))
  const [shipping, deliveries] = await Promise.all([
    shippingOf(scope, ids),
    deliveriesOf(scope, full as unknown as DisplayRow[]),
  ])
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
              customer: customerOf(order.shipping_address),
              shipping: shipping.get(id) ?? null,
              delivery: deliveries.get(id) ?? null,
              addons: addonsOf(order.items),
            },
          ]
        : []
    }),
    count: slice.count,
    counts: slice.counts,
    offset,
    limit: ORDER_BOARD_PAGE,
    limited,
  }
}

export type OrderBoard = Awaited<ReturnType<typeof readOrderBoard>>
