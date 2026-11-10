import { useMutation, useQueryClient } from "@tanstack/react-query"
import { saveVariantEdits } from "@/features/products/api/product-edit"
import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { sdk } from "@/lib/sdk"
import { priceEdit, variantEdit } from "./variant-values"
import type { Variant, VariantField, VariantImage, VariantValues } from "./variant-values"

export interface VariantSave {
  variant: Variant
  values: VariantValues
  /** What the dialog started from: only what differs from it is sent. */
  saved: VariantValues
  dirty: Partial<Record<VariantField, boolean>> | undefined
}

const order = (images: readonly VariantImage[]) => images.map((image) => image.url).join("\n")

/**
 * The product's pictures after the dialog: a new order or a picture added
 * from the library saves the product's gallery (the first picture its
 * thumbnail), then the variant is tied to or untied from each picture
 * whose tie changed. Returns nothing; the product is read again after.
 */
async function savePictures(
  product: ProductDetail,
  variantId: string,
  saved: readonly VariantImage[],
  next: readonly VariantImage[]
): Promise<void> {
  const ids = new Map(next.flatMap((image) => (image.imageId ? [[image.url, image.imageId]] : [])))
  if (next.some((image) => image.imageId === null) || order(next) !== order(saved)) {
    const { product: updated } = await sdk.admin.product.update(product.id, {
      images: next.map((image) =>
        image.imageId ? { id: image.imageId, url: image.url } : { url: image.url }
      ),
      thumbnail: next[0]?.url ?? null,
    })
    for (const image of updated.images ?? []) {
      ids.set(image.url, image.id)
    }
  }
  const before = new Map(saved.map((image) => [image.key, image.tied]))
  const changed = next.filter((image) => image.tied !== (before.get(image.key) ?? false))
  const idsOf = (tied: boolean) =>
    changed.flatMap((image) => {
      const id = image.tied === tied ? ids.get(image.url) : undefined
      return id ? [id] : []
    })
  const add = idsOf(true)
  const remove = idsOf(false)
  if (add.length > 0 || remove.length > 0) {
    await sdk.admin.product.batchVariantImages(product.id, variantId, { add, remove })
  }
}

/** Alt texts typed in the dialog, each saved to the picture's media record. */
async function saveAlts(
  saved: readonly VariantImage[],
  next: readonly VariantImage[]
): Promise<void> {
  const before = new Map(saved.map((image) => [image.key, image.alt.trim()]))
  const changed = next.filter(
    (image) => image.mediaId !== null && image.alt.trim() !== (before.get(image.key) ?? "")
  )
  for (const image of changed) {
    await sdk.client.fetch(`/admin/media/${encodeURIComponent(image.mediaId ?? "")}`, {
      method: "POST",
      body: { alt: image.alt.trim() },
    })
  }
}

/**
 * Everything the variant's dialog changed, in one save: its own fields
 * (and the price for every variant, when asked), then the pictures, then
 * their alt texts. A save that stops half-way has still changed the
 * product, so it is read again either way.
 */
export function useSaveVariant(product: ProductDetail, locationId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ variant, values, saved, dirty }: VariantSave) => {
      const amount = parseMoneyInput(values.price)
      const others =
        values.applyAll && amount !== null
          ? (product.variants ?? [])
              .filter((other) => other.id !== variant.id)
              .map((other) => priceEdit(other, amount))
          : []
      const edits = [variantEdit(variant, values, dirty, locationId), ...others].filter(
        (edit): edit is VariantEdit => edit !== null
      )
      if (edits.length > 0) {
        await saveVariantEdits(product.id, { edits, locationId })
      }
      await savePictures(product, variant.id, saved.images, values.images)
      await saveAlts(saved.images, values.images)
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["seo"] }),
        client.invalidateQueries({ queryKey: ["media"] }),
      ])
    },
  })
}
