import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/** One of the product's images whose versions are (re)made, at its place among them. */
export interface DeriveTarget {
  assetId: string
  fileId: string
  /** `{handle}:{position}`: what the versions are named after. */
  derivedFor: string
  handle: string
  position: number
}

export interface MediaPlan {
  productId: string
  /** Assets of the product's images not linked to any product yet. */
  link: string[]
  /** Images with no record at all (added by URL): they get one, for an alt text. */
  record: string[]
  /** Assets linked to the product whose image it no longer has. */
  unlink: string[]
  derive: DeriveTarget[]
}

interface ProductRow {
  id: string
  handle: string
  images?: ({ url: string; rank: number } | null)[] | null
  media_assets?: ({ id: string; url: string } | null)[] | null
}

interface AssetRow {
  id: string
  url: string
  file_id: string | null
  derived_for: string | null
  product?: { id: string } | null
}

async function readProduct(container: MedusaContainer, productId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "images.url", "images.rank", "media_assets.id", "media_assets.url"],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    return null
  }
  const images = (product.images ?? [])
    .flatMap((image) => (image ? [image] : []))
    .sort((a, b) => a.rank - b.rank)
  const urls = images.map((image) => image.url)
  const { data: rows } = urls.length
    ? await query.graph({
        entity: "media_asset",
        fields: ["id", "url", "file_id", "derived_for", "product.id"],
        filters: { url: urls },
      })
    : { data: [] }
  return { product, urls, assets: new Map((rows as AssetRow[]).map((row) => [row.url, row])) }
}

/**
 * What a product's images need (F3.3): which records join it (one is made
 * for an image added by URL alone), which leave it, and which get their
 * versions made again because the product's slug or the image's place
 * changed. An image another product holds is left to that product.
 */
export const planProductMediaStep = createStep(
  "media-plan-product",
  async (productId: string, { container }) => {
    const plan: MediaPlan = { productId, link: [], record: [], unlink: [], derive: [] }
    const read = await readProduct(container, productId)
    if (!read) {
      return new StepResponse(plan)
    }
    const { product, urls, assets } = read
    urls.forEach((url, index) => {
      const asset = assets.get(url)
      if (!asset) {
        plan.record.push(url)
        return
      }
      const owner = asset.product?.id
      if (owner && owner !== productId) {
        return
      }
      if (!owner) {
        plan.link.push(asset.id)
      }
      const derivedFor = `${product.handle}:${String(index + 1)}`
      if (asset.file_id && asset.derived_for !== derivedFor) {
        plan.derive.push({
          assetId: asset.id,
          fileId: asset.file_id,
          derivedFor,
          handle: product.handle,
          position: index + 1,
        })
      }
    })
    const kept = new Set(urls)
    plan.unlink = (product.media_assets ?? []).flatMap((asset) =>
      asset && !kept.has(asset.url) ? [asset.id] : []
    )
    return new StepResponse(plan)
  }
)
