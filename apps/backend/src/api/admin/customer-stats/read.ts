import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOT_SALES, TOTALS_CURRENCY, customerTotals } from "../../../lib/customers/totals"
import type { CustomerTotals, TotalsOrder } from "../../../lib/customers/totals"

// A list page's customers rarely have more; past this the numbers cover the newest and say so
export const MAX_STATS_ORDERS = 5000
const PAGE = 1000

interface OwnAddress {
  province?: string | null
  city?: string | null
  is_default_shipping?: boolean | null
}

/** Each customer's own city: the default shipping address's il, else the first address's. */
async function ownCities(
  scope: MedusaContainer,
  ids: readonly string[]
): Promise<Map<string, string | null>> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "addresses.province", "addresses.city", "addresses.is_default_shipping"],
    filters: { id: [...ids] },
  })
  const rows = data as { id: string; addresses?: (OwnAddress | null)[] | null }[]
  return new Map(
    rows.map((row) => {
      const addresses = (row.addresses ?? []).filter((a): a is OwnAddress => a !== null)
      const chosen = addresses.find((a) => a.is_default_shipping) ?? addresses[0]
      const text = (chosen?.province ?? chosen?.city ?? "").trim()
      return [row.id, text === "" ? null : text]
    })
  )
}

export interface CustomerStatsAnswer {
  stats: CustomerTotals[]
  currency_code: string
  capped: boolean
}

/**
 * The customers' order totals (CU1, O4): all their sales read together,
 * newest first, a page at a time, never one customer after another. No
 * names, e-mails or addresses leave, only the city.
 */
export async function readCustomerStats(
  scope: MedusaContainer,
  ids: readonly string[]
): Promise<CustomerStatsAnswer> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const orders: TotalsOrder[] = []
  let count = 0
  for (let skip = 0; skip < MAX_STATS_ORDERS; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity: "order",
      fields: [
        "customer_id",
        "status",
        "currency_code",
        "total",
        "created_at",
        "shipping_address.province",
        "shipping_address.city",
      ],
      filters: {
        customer_id: [...ids],
        status: { $nin: [...NOT_SALES] },
        is_draft_order: false,
        currency_code: TOTALS_CURRENCY,
      },
      pagination: { skip, take: PAGE, order: { created_at: "DESC", id: "DESC" } },
    })
    orders.push(...(data as TotalsOrder[]))
    count = metadata?.count ?? orders.length
    if (data.length < PAGE || orders.length >= count) {
      break
    }
  }
  return {
    stats: customerTotals(ids, orders, await ownCities(scope, ids)),
    currency_code: TOTALS_CURRENCY,
    capped: count > orders.length,
  }
}
