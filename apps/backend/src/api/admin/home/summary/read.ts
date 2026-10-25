import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { awaitingShipment, salesByCurrency, startOfTurkishDay } from "./summarize"
import type { OpenOrder } from "./summarize"

// Orders read at most for a number (docs/04: bulk reads are paged); a shop
// past this sees "1000+". Their counts come from the database regardless
export const MAX_ORDERS_READ = 1000

const NOT_SALES = ["canceled", "draft", "archived"]

/**
 * What the home page shows of the orders (docs/17): open orders, how many of
 * them wait to be shipped, and today's sales. Only statuses and amounts are
 * read: no customer data, so no read record (adr/0011).
 */
export async function readHomeSummary(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [open, today] = await Promise.all([
    query.graph({
      entity: "order",
      fields: [
        "id",
        "currency_code",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
        "fulfillments.canceled_at",
      ],
      filters: { status: ["pending", "requires_action"], is_draft_order: false },
      pagination: { skip: 0, take: MAX_ORDERS_READ },
    }),
    query.graph({
      entity: "order",
      fields: ["id", "currency_code", "total"],
      filters: {
        created_at: { $gte: startOfTurkishDay() },
        status: { $nin: NOT_SALES },
        is_draft_order: false,
      },
      pagination: { skip: 0, take: MAX_ORDERS_READ },
    }),
  ])
  const openOrders = open.data as OpenOrder[]
  const openCount = open.metadata?.count ?? openOrders.length
  const todayCount = today.metadata?.count ?? today.data.length
  return {
    open_orders: openCount,
    awaiting_shipment: awaitingShipment(openOrders),
    // More orders than were read: the number covers the first ones
    capped: openCount > openOrders.length,
    today: {
      orders: todayCount,
      sales: salesByCurrency(today.data),
      capped: todayCount > today.data.length,
    },
  }
}

export type HomeSummary = Awaited<ReturnType<typeof readHomeSummary>>
