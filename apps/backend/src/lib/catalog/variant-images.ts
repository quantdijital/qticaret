import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../errors"

/**
 * A new product's variant pictures, sent with the product itself
 * (`additional_data.variant_images` of `POST /admin/products`): the panel
 * picks them before the product exists, so neither the variant nor the
 * picture has an id yet. A variant is named by its option values (unique
 * within a product), a picture by its address among the product's.
 */

const MAX_VARIANTS = 500
// A product keeps up to twenty pictures (the panel's gallery); a variant names some of them
const MAX_IMAGES = 20
const text = z.string().trim().min(1).max(200)

export const VariantImagesInput = z
  .array(
    z
      .object({
        options: z.record(text, text),
        image_urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(MAX_IMAGES),
      })
      .strict()
  )
  .max(MAX_VARIANTS)
export type VariantImagesInputType = z.infer<typeof VariantImagesInput>

/** The product as created: its pictures, options and variants with their values. */
export interface CreatedProductShape {
  images?: ({ id: string; url: string } | null)[] | null
  options?: ({ id: string; title: string } | null)[] | null
  variants?:
    | ({
        id: string
        options?: ({ value: string; option_id?: string | null } | null)[] | null
      } | null)[]
    | null
}

export interface VariantImageTie {
  image_id: string
  variant_id: string
}

const FIELD = "additional_data.variant_images"

/** Option values as "title=value" pairs in a fixed order: one key for a variant, sent or stored. */
const optionsKey = (pairs: readonly (readonly [string, string])[]) =>
  pairs
    .map(([title, value]) => `${title.trim()}=${value.trim()}`)
    .sort()
    .join("\u0000")

/** The input as sent, or none; a malformed one (a direct workflow call) is refused. */
export function readVariantImages(additional: unknown): VariantImagesInputType {
  const raw = (additional as { variant_images?: unknown } | null | undefined)?.variant_images
  if (raw === undefined || raw === null) {
    return []
  }
  const parsed = VariantImagesInput.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("catalog.variant_images_invalid", { field: FIELD })
  }
  return parsed.data
}

/**
 * Each wanted picture tied to its variant, by id. A variant or a picture
 * the product does not have is refused (the product is not saved half
 * right); a picture added twice by one address is tied in both places.
 */
export function planVariantImageTies(
  product: CreatedProductShape,
  wanted: VariantImagesInputType
): VariantImageTie[] {
  const titles = new Map(
    (product.options ?? []).flatMap((option) => (option ? [[option.id, option.title]] : []))
  )
  const variantOf = new Map(
    (product.variants ?? []).flatMap((variant) =>
      variant
        ? [
            [
              optionsKey(
                (variant.options ?? []).flatMap((value) =>
                  value ? [[titles.get(value.option_id ?? "") ?? "", value.value] as const] : []
                )
              ),
              variant.id,
            ] as const,
          ]
        : []
    )
  )
  const imagesOf = new Map<string, string[]>()
  for (const image of product.images ?? []) {
    if (image) {
      imagesOf.set(image.url, [...(imagesOf.get(image.url) ?? []), image.id])
    }
  }
  const ties = new Map<string, VariantImageTie>()
  for (const entry of wanted) {
    const variantId = variantOf.get(optionsKey(Object.entries(entry.options)))
    if (!variantId) {
      throw new ValidationError("catalog.variant_image_variant_unknown", { field: FIELD })
    }
    for (const url of entry.image_urls) {
      const ids = imagesOf.get(url)
      if (!ids) {
        throw new ValidationError("catalog.variant_image_unknown", { field: FIELD })
      }
      for (const imageId of ids) {
        ties.set(`${imageId}\u0000${variantId}`, { image_id: imageId, variant_id: variantId })
      }
    }
  }
  return [...ties.values()]
}
