import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Orders read at most per window (docs/04: bulk reads are paged); past this
// the numbers cover the first ones and the answer says so
export const MAX_ORDERS_READ = 5000

// Not sales: drafts and archived records
export const NOT_ORDERS = ["draft", "archived"]

interface OrdersPage<T> {
  rows: T[]
  count: number
}

// Read a page at a time: a year's report reads tens of thousands, never at once
const PAGE = 1_000

/**
 * Orders created in `[from, to)` with the given fields, oldest first, up
 * to `max` (the dashboard's MAX_ORDERS_READ unless a report reads more);
 * `count` says how many there were.
 */
export async function ordersBetween<T>(
  scope: MedusaContainer,
  fields: string[],
  from: Date,
  to: Date,
  max: number = MAX_ORDERS_READ
): Promise<OrdersPage<T>> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const rows: T[] = []
  let count = 0
  for (let skip = 0; skip < max; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity: "order",
      fields,
      filters: {
        created_at: { $gte: from, $lt: to },
        status: { $nin: NOT_ORDERS },
        is_draft_order: false,
      },
      pagination: {
        skip,
        take: Math.min(PAGE, max - skip),
        order: { created_at: "ASC", id: "ASC" },
      },
    })
    rows.push(...(data as T[]))
    count = metadata?.count ?? rows.length
    if (data.length < PAGE || rows.length >= count) {
      break
    }
  }
  return { rows, count }
}
