import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf } from "../../../../lib/dashboard"
import type { LifecycleOrder } from "../../../../lib/dashboard"

// Open orders and stock records read at most (docs/04); past this the
// counts are floors and the answer says so
const MAX_READ = 2000

// A placeholder until F3 T8 gives each item its own threshold (adr/0020)
export const LOW_STOCK_THRESHOLD = 5

interface StockRow {
  location_levels?:
    ({ stocked_quantity?: number | null; reserved_quantity?: number | null } | null)[] | null
}

const available = (row: StockRow): number =>
  (row.location_levels ?? []).reduce(
    (sum, level) => sum + (level?.stocked_quantity ?? 0) - (level?.reserved_quantity ?? 0),
    0
  )

/**
 * What waits for the shop (docs/17): orders to ship or still unpaid, stock
 * running low, products left as drafts. Counts only; no personal data.
 */
export async function readDashboardTasks(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const [open, stock, drafts] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["id", ...LIFECYCLE_FIELDS],
      filters: { status: ["pending", "requires_action"], is_draft_order: false },
      pagination: { skip: 0, take: MAX_READ },
    }),
    query.graph({
      entity: "inventory_item",
      fields: ["id", "location_levels.stocked_quantity", "location_levels.reserved_quantity"],
      pagination: { skip: 0, take: MAX_READ },
    }),
    query.graph({
      entity: "product",
      fields: ["id"],
      filters: { status: "draft" },
      pagination: { skip: 0, take: 1 },
    }),
  ])
  const orders = open.data as LifecycleOrder[]
  const stages = orders.map(lifecycleOf)
  const items = stock.data as StockRow[]
  return {
    to_ship: stages.filter((stage) => stage === "to_ship").length,
    awaiting_payment: stages.filter((stage) => stage === "awaiting_payment").length,
    low_stock: items.filter((row) => available(row) <= LOW_STOCK_THRESHOLD).length,
    low_stock_threshold: LOW_STOCK_THRESHOLD,
    draft_products: drafts.metadata?.count ?? drafts.data.length,
    capped:
      (open.metadata?.count ?? 0) > orders.length || (stock.metadata?.count ?? 0) > items.length,
  }
}

export type DashboardTasks = Awaited<ReturnType<typeof readDashboardTasks>>
