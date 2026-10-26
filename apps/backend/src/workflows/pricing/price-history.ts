import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import type { PriceRecordReason } from "../../modules/price-history/service"
import { priceSetsOfLists, variantsOfPriceSets } from "./priced-variants"
import { recordSellingPricesStep } from "./steps/record-selling-prices"
import type { RecordSellingPricesInput } from "./steps/record-selling-prices"

/** The price history's one way in (F4.2, ADR-0023): these variants' selling prices, where they changed. */
export const recordSellingPricesWorkflow = createWorkflow(
  "price-history-record",
  (input: RecordSellingPricesInput) => new WorkflowResponse(recordSellingPricesStep(input))
)

const PAGE = 200

async function recordPages(container: MedusaContainer, reason: PriceRecordReason) {
  const product = container.resolve(Modules.PRODUCT)
  let recorded = 0
  for (let skip = 0; ; skip += PAGE) {
    const variants = await product.listProductVariants(
      {},
      { select: ["id"], skip, take: PAGE, order: { id: "ASC" } }
    )
    if (variants.length > 0) {
      try {
        const { result } = await recordSellingPricesWorkflow(container).run({
          input: { variant_ids: variants.map((variant) => variant.id), reason },
        })
        recorded += result
      } catch (error) {
        logger.warn({ event: "price_history.page_failed", skip, err: errorSummary(error) })
      }
    }
    if (variants.length < PAGE) {
      return recorded
    }
  }
}

/**
 * Every variant's selling price, recorded where it changed (ADR-0023): the
 * hourly check finds a price list that began or ended (no event tells of
 * it) and what events missed; the first run on a shop opens its history.
 * A page that fails is logged and skipped; the next run writes it. One run
 * at a time across processes: another that finds it running gives up
 * (throws). Returns the records written.
 */
export async function recordAllSellingPrices(
  container: MedusaContainer,
  reason: PriceRecordReason
): Promise<number> {
  return container
    .resolve(Modules.LOCKING)
    .execute("price-history-all", () => recordPages(container, reason), { timeout: 1 })
}

// Boundaries looked back over: a run that starts late still finds its own
const BOUNDARY_WINDOW_MS = 5 * 60_000

interface ListBoundary {
  id: string
  at: Date
}

async function listBoundaries(container: MedusaContainer, from: Date, to: Date) {
  const pricing = container.resolve(Modules.PRICING)
  const select = { select: ["id", "starts_at", "ends_at"], take: null }
  const [starting, ending] = await Promise.all([
    pricing.listPriceLists(
      { starts_at: { $gt: from.toISOString(), $lte: to.toISOString() } },
      select
    ),
    pricing.listPriceLists(
      { ends_at: { $gt: from.toISOString(), $lte: to.toISOString() } },
      select
    ),
  ])
  const boundaries: ListBoundary[] = [
    ...starting.flatMap((list) =>
      list.starts_at ? [{ id: list.id, at: new Date(list.starts_at) }] : []
    ),
    ...ending.flatMap((list) =>
      list.ends_at ? [{ id: list.id, at: new Date(list.ends_at) }] : []
    ),
  ]
  return boundaries.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/**
 * Price lists that began or ended in the last few minutes (ADR-0023): no
 * event tells of it, so the minute job reads them and records their
 * variants' prices as of the boundary, not the hour after it. A list's
 * prices are read as they are when the job runs: one that begins and ends
 * between two runs is missed. Returns the records written.
 */
export async function recordListBoundaries(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<number> {
  const boundaries = await listBoundaries(
    container,
    new Date(now.getTime() - BOUNDARY_WINDOW_MS),
    now
  )
  let recorded = 0
  for (const boundary of boundaries) {
    const variantIds = await variantsOfPriceSets(
      container,
      await priceSetsOfLists(container, [boundary.id])
    )
    if (variantIds.length > 0) {
      const { result } = await recordSellingPricesWorkflow(container).run({
        input: {
          variant_ids: variantIds,
          reason: "price_change",
          recorded_at: boundary.at.toISOString(),
        },
      })
      recorded += result
    }
  }
  return recorded
}

/** A lock another process holds: Medusa's providers time out with this message. */
export const isLockBusy = (error: unknown): boolean =>
  error instanceof Error && /acquir(e|ing) lock/iu.test(error.message)
