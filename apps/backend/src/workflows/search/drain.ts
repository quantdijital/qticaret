import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { errorSummary, logger } from "../../lib/logging"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import type { PendingClaim } from "../../modules/search-index/types"
import { reindexSearchProductsWorkflow } from "./reindex"

/**
 * How the index keeps up with the catalogue (adr/0056). A change marks its
 * products pending (one cheap statement, after the change is done: an
 * event's subscriber, an import's run) and starts this process's drain,
 * which indexes them in batches until none is left. One drain a process
 * at a time; others across processes take other products (claims). A
 * batch that fails is indexed product by product, so one broken product
 * holds back only itself; it is tried again by the minute job.
 */

/** Products indexed per workflow run. */
export const DRAIN_BATCH = 200
const ENQUEUE_PAGE = 1_000

const indexOf = (container: MedusaContainer) =>
  container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

let running: Promise<number> | null = null
let again = false
// Read through a call: a drain started meanwhile sets it while this one awaits
const wantsAgain = (): boolean => again

async function indexClaims(
  container: MedusaContainer,
  claims: PendingClaim[]
): Promise<PendingClaim[]> {
  try {
    await reindexSearchProductsWorkflow(container).run({
      input: { product_ids: claims.map((claim) => claim.product_id) },
    })
    return claims
  } catch (error) {
    if (claims.length === 1) {
      logger.warn({
        event: "search_index.product_failed",
        product_id: claims[0]?.product_id,
        err: errorSummary(error),
      })
      return []
    }
  }
  const done: PendingClaim[] = []
  for (const claim of claims) {
    done.push(...(await indexClaims(container, [claim])))
  }
  return done
}

async function drainOnce(container: MedusaContainer): Promise<number> {
  const index = indexOf(container)
  let indexed = 0
  for (;;) {
    const claims = await index.claimPending(DRAIN_BATCH)
    if (claims.length === 0) {
      return indexed
    }
    const done = await indexClaims(container, claims)
    await index.finishPending(done)
    indexed += done.length
  }
}

/**
 * Indexes what is pending; resolves when nothing is left that this
 * process can take. Called while running, it runs once more before it
 * resolves, so a caller's own products are always included.
 */
export function drainSearchIndex(container: MedusaContainer): Promise<number> {
  if (running) {
    again = true
    return running
  }
  const loop = async () => {
    let indexed = 0
    do {
      again = false
      indexed += await drainOnce(container)
    } while (wantsAgain())
    return indexed
  }
  running = loop().finally(() => {
    running = null
  })
  return running
}

/**
 * These products are indexed again soon. Never throws and never waits for
 * the index: a catalogue change is done whatever the index does; a missed
 * mark is caught by the nightly rebuild.
 */
export async function queueSearchProducts(
  container: MedusaContainer,
  productIds: readonly string[]
): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (ids.length === 0) {
    return
  }
  try {
    await indexOf(container).markPending(ids)
    drainSearchIndex(container).catch((error: unknown) => {
      logger.warn({ event: "search_index.drain_failed", err: errorSummary(error) })
    })
  } catch (error) {
    logger.warn({ event: "search_index.queue_failed", err: errorSummary(error) })
  }
}

/**
 * Every product of the catalogue, and every row of the index (a row whose
 * product is gone is taken out), marked pending a page at a time.
 */
export async function queueAllProducts(container: MedusaContainer): Promise<number> {
  const index = indexOf(container)
  const products = container.resolve(Modules.PRODUCT)
  let queued = 0
  for (let skip = 0; ; skip += ENQUEUE_PAGE) {
    const page = await products.listProducts(
      {},
      { select: ["id"], skip, take: ENQUEUE_PAGE, order: { id: "ASC" } }
    )
    await index.markPending(page.map((product) => product.id))
    queued += page.length
    if (page.length < ENQUEUE_PAGE) {
      break
    }
  }
  for (let after = ""; ;) {
    const ids = await index.documentIds(after, ENQUEUE_PAGE)
    for (const chunk of chunksOf(ids, ENQUEUE_PAGE)) {
      await index.markPending(chunk)
    }
    if (ids.length < ENQUEUE_PAGE) {
      return queued
    }
    after = ids.at(-1) ?? after
  }
}

/** The whole index made again now (the rebuild script, the nightly job, tests): waits for it. */
export async function rebuildSearchIndex(container: MedusaContainer): Promise<number> {
  await queueAllProducts(container)
  const indexed = await drainSearchIndex(container)
  await indexOf(container).refreshWords()
  return indexed
}

/** A shop whose index was never built (the first start after the migration): built now. */
export async function buildIfEmpty(container: MedusaContainer): Promise<boolean> {
  const index = indexOf(container)
  const [rows, pending, products] = await Promise.all([
    index.documentIds("", 1),
    index.pendingCount(),
    container.resolve(Modules.PRODUCT).listProducts({}, { select: ["id"], take: 1 }),
  ])
  if (rows.length > 0 || pending > 0 || products.length === 0) {
    return false
  }
  await queueAllProducts(container)
  return true
}
