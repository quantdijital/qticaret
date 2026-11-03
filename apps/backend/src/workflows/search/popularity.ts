import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"

/**
 * A product's popularity in search (adr/0056): the orders of the last 30
 * days that hold it. An order placed counts at once (+1 for each product
 * in it); the nightly job counts the window again, so orders leave it
 * after 30 days and a cancelled one stops counting.
 */

export const POPULARITY_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const PAGE = 1_000
// Not sales: drafts, archived and cancelled orders
const NOT_SALES = ["draft", "archived", "canceled"]

interface Items {
  items?: ({ product_id?: string | null } | null)[] | null
}

const productsOf = (order: Items): string[] => [
  ...new Set((order.items ?? []).flatMap((item) => (item?.product_id ? [item.product_id] : []))),
]

/** The order's products count once more; undone by counting them once less. */
export const bumpSearchPopularityStep = createStep(
  "search-index-bump-popularity",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["items.product_id"],
      filters: { id: input.order_id },
    })
    const ids = productsOf(data[0] ?? {})
    await container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).bumpPopularity(ids, 1)
    return new StepResponse(ids.length, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).bumpPopularity(ids, -1)
    }
  }
)

export const recordOrderPopularityWorkflow = createWorkflow(
  "search-index-order-popularity",
  (input: { order_id: string }) => new WorkflowResponse(bumpSearchPopularityStep(input))
)

/** How many orders of the last 30 days hold each product, read a page at a time. */
export async function recentOrderCounts(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<Record<string, number>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(now.getTime() - POPULARITY_DAYS * DAY_MS)
  const counts: Record<string, number> = {}
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "items.product_id"],
      filters: { created_at: { $gte: since }, status: { $nin: NOT_SALES }, is_draft_order: false },
      pagination: { skip, take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    for (const order of data as Items[]) {
      for (const id of productsOf(order)) {
        counts[id] = (counts[id] ?? 0) + 1
      }
    }
    if (data.length < PAGE) {
      return counts
    }
  }
}
