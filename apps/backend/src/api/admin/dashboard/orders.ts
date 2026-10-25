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

/** Orders created in `[from, to)` with the given fields, newest last. */
export async function ordersBetween<T>(
  scope: MedusaContainer,
  fields: string[],
  from: Date,
  to: Date
): Promise<OrdersPage<T>> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "order",
    fields,
    filters: {
      created_at: { $gte: from, $lt: to },
      status: { $nin: NOT_ORDERS },
      is_draft_order: false,
    },
    pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "ASC" } },
  })
  return { rows: data as T[], count: metadata?.count ?? data.length }
}
