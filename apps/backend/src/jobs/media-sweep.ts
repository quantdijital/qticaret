import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import {
  deriveProductMediaWorkflow,
  removeAbandonedMediaWorkflow,
} from "../workflows/media/workflows"
import { sweepProductVideosWorkflow } from "../workflows/media/video/workflows"

const PAGE = 500
// An upload no product took within a day was left behind (a wizard closed)
const ABANDONED_MS = 24 * 60 * 60 * 1000

interface AssetRow {
  id: string
  attached_at: string | Date | null
  in_library?: boolean | null
  created_at: string | Date
  product?: { id: string } | null
}

async function readAssets(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = new Set<string>()
  const abandoned: string[] = []
  const before = Date.now() - ABANDONED_MS
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "media_asset",
      fields: ["id", "attached_at", "in_library", "created_at", "product.id"],
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    for (const asset of data as AssetRow[]) {
      if (asset.product?.id) {
        products.add(asset.product.id)
      } else if (
        !asset.attached_at &&
        !asset.in_library &&
        new Date(asset.created_at).getTime() < before
      ) {
        abandoned.push(asset.id)
      }
    }
    if (data.length < PAGE) {
      return { products, abandoned }
    }
  }
}

/**
 * Keeps product images tidy each night (F3.3): every product with images
 * is brought in line again (a missed save, a failed version; nothing to do
 * costs a query), and uploads no product ever took go after a day. An image
 * a product once had stays: orders and emails may show it. So does one put
 * in the media library: it goes only when deleted there. Videos left
 * without a product for a day go, and a failed clip's source after a week
 * (adr/0069 §11).
 */
export default async function mediaSweep(container: MedusaContainer) {
  const { products, abandoned } = await readAssets(container)
  for (const productId of products) {
    try {
      await deriveProductMediaWorkflow(container).run({ input: { product_id: productId } })
    } catch (error) {
      logger.warn({ event: "media.derive_failed", productId, err: errorSummary(error) })
    }
  }
  const { result: removed } = await removeAbandonedMediaWorkflow(container).run({
    input: { ids: abandoned },
  })
  logger.info({ event: "media.swept", products: products.size, removed })
  try {
    const { result: videos } = await sweepProductVideosWorkflow(container).run({
      input: { now: Date.now() },
    })
    logger.info({ event: "media.videos_swept", ...videos })
  } catch (error) {
    logger.warn({ event: "media.videos_sweep_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "media-sweep",
  schedule: "45 3 * * *",
}
