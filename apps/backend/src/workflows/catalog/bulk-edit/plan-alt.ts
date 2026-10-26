import { suggestedAlts } from "../../../lib/media/alt"
import type { BulkPlan } from "./plan"
import type { BulkProduct } from "./products"

/**
 * The missing alt texts of a product's images (F3.10, docs/14 §4), from
 * its name and, for an image of one variant, that variant's values. An
 * image's text lives on its media record; one without a record (added by
 * URL before the image pipeline) is left as it is. Texts already written
 * are kept.
 */
export function altWrites(product: BulkProduct): BulkPlan {
  const images = [...(product.images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const assets = new Map(
    (product.media_assets ?? []).flatMap((asset) => (asset ? [[asset.url, asset]] : []))
  )
  const order = new Map((product.options ?? []).map((option, index) => [option.id, index]))
  const variantValues = new Map(
    (product.variants ?? []).map((variant) => [
      variant.id,
      [...(variant.options ?? [])]
        .sort((a, b) => (order.get(a.option_id) ?? 0) - (order.get(b.option_id) ?? 0))
        .map((value) => value.value),
    ])
  )
  const texts = suggestedAlts({
    title: product.title,
    images: images.map((image) => ({
      variantIds: (image.variants ?? []).map((variant) => variant.id),
    })),
    variantValues,
  })
  const alts = images.flatMap((image, index) => {
    const asset = assets.get(image.url)
    const text = texts[index]
    return asset && !asset.alt?.trim() && text ? [{ id: asset.id, alt: text }] : []
  })
  if (alts.length > 0) {
    return { kind: "write", write: { action: "alt_text", alts } }
  }
  // Images still without a text that no record can hold
  const unlabelled = images.some((image) => !assets.get(image.url)?.alt?.trim())
  return unlabelled ? { kind: "skipped", key: "bulk_edit.alt_no_record" } : { kind: "unchanged" }
}
