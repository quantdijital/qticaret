import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { deriveLibraryMediaWorkflow, deriveProductMediaWorkflow } from "./workflows"

/** How many pictures are read, and made, at a time. */
export const BACKFILL_BATCH = 50

export interface BackfillCounts {
  /** Stored pictures without versions when the run read them. */
  missing: number
  /** Of them, the ones no product holds: named after themselves. */
  library: number
  /** Of them, a product's: made by their product's own run (adr/0016). */
  product_images: number
  products: number
  /** Pictures that got their versions this run (apply). */
  made: number
  /** Pictures that did not: the master unreadable, storage refusing; a later run tries again. */
  failed: number
}

interface Row {
  id: string
  product?: { id: string } | null
}

/** One page of stored pictures without versions, after `after` by id. */
async function pageAfter(container: MedusaContainer, after: string | null, take: number) {
  const ids = await container.resolve<MediaModuleService>(MEDIA_MODULE).listMediaAssets(
    {
      file_id: { $ne: null },
      derivatives: null,
      ...(after ? { id: { $gt: after } } : {}),
    },
    { select: ["id"], order: { id: "ASC" }, take }
  )
  if (ids.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "media_asset",
    fields: ["id", "product.id"],
    filters: { id: ids.map((row) => row.id) },
  })
  const products = new Map((data as Row[]).map((row) => [row.id, row.product?.id ?? null]))
  return ids.map((row) => ({ id: row.id, product: products.get(row.id) ?? null }))
}

/** A product's images through its own run; a failure is logged and counted after. */
async function deriveProduct(container: MedusaContainer, productId: string): Promise<void> {
  try {
    await deriveProductMediaWorkflow(container).run({ input: { product_id: productId } })
  } catch (error) {
    logger.warn({ event: "media.derive_failed", productId, err: errorSummary(error) })
  }
}

/**
 * The versions of the pictures stored before every upload got them (docs/21
 * 2026-11-06, open item 1): each stored picture without versions, a batch
 * at a time in id order. One no product holds gets them named after
 * itself; a product's goes through its product's run. Without `apply`
 * nothing is made: the counts say what would be. A picture with versions
 * is never read again, so a run stopped halfway goes on where it was and a
 * second run finds none (but the ones that failed).
 */
export async function backfillMediaVersions(
  container: MedusaContainer,
  { apply, batch = BACKFILL_BATCH }: { apply: boolean; batch?: number }
): Promise<BackfillCounts> {
  const counts: BackfillCounts = {
    missing: 0,
    library: 0,
    product_images: 0,
    products: 0,
    made: 0,
    failed: 0,
  }
  // A product's pictures without versions, by product: one run each
  const products = new Map<string, string[]>()
  let after: string | null = null
  for (;;) {
    const page = await pageAfter(container, after, batch)
    if (page.length === 0) {
      break
    }
    after = page[page.length - 1]?.id ?? null
    counts.missing += page.length
    const library = page.filter((row) => !row.product).map((row) => row.id)
    counts.library += library.length
    for (const row of page) {
      if (row.product) {
        counts.product_images += 1
        products.set(row.product, [...(products.get(row.product) ?? []), row.id])
      }
    }
    if (apply && library.length > 0) {
      const { result } = await deriveLibraryMediaWorkflow(container).run({
        input: { ids: library },
      })
      counts.made += result.length
      counts.failed += library.length - result.length
    }
  }
  counts.products = products.size
  if (apply && products.size > 0) {
    for (const productId of products.keys()) {
      await deriveProduct(container, productId)
    }
    // What the products' runs made: their pictures that have versions now
    const ids = [...products.values()].flat()
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    for (let start = 0; start < ids.length; start += batch) {
      const still = await media.listMediaAssets(
        { id: ids.slice(start, start + batch), derivatives: null },
        { select: ["id"], take: null }
      )
      counts.failed += still.length
      counts.made += Math.min(batch, ids.length - start) - still.length
    }
  }
  return counts
}
