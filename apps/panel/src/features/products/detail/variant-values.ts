import { z } from "zod"
import type { VariantEdit, VariantMeasures } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { formatMoneyInput, parseMoneyInput, parseMeasureInput } from "@/lib/money-input"
import { MEASURES, measureSchema, measureText } from "./measures"
import { VARIANT_CODES_TARGET } from "./sections"
import { codeEdits, MPN_MAX, savedCodes, SKU_MAX, typedGtinError } from "./variant-codes"
import type { CatalogVariant } from "./variant-codes"

const CURRENCY = "try"
const MAX_COST = 10_000_000
// What screen readers read comfortably; the server allows no more
export const ALT_MAX = 250

/**
 * One of the product's pictures as a variant's dialog sees it: whether the
 * variant is tied to it, and its alt text. A picture picked from the
 * library in the dialog has no image id until it is saved.
 */
const imageSchema = z.object({
  key: z.string(),
  url: z.string(),
  imageId: z.string().nullable(),
  /** The media record its alt text is kept in; none for an old picture added by address. */
  mediaId: z.string().nullable(),
  alt: z.string().trim().max(ALT_MAX, { message: "products.errors.alt" }),
  tied: z.boolean(),
})
export type VariantImage = z.infer<typeof imageSchema>

const variantSchema = z.object({
  price: z
    .string()
    .refine((text) => (parseMoneyInput(text) ?? 0) > 0, { message: "products.errors.price" }),
  stock: z.string().refine((text) => /^\d+$/.test(text.trim()) && Number(text) <= 1_000_000, {
    message: "products.errors.stock",
  }),
  backorder: z.boolean(),
  // Unit cost, VAT excluded (F11.4): empty means not entered
  cost: z.string().refine(
    (text) => {
      if (text.trim() === "") {
        return true
      }
      const value = parseMoneyInput(text)
      return value !== null && value >= 0 && value <= MAX_COST
    },
    { message: "products.errors.cost" }
  ),
  // The identifiers (variant-codes.ts): all may be empty; a typed barcode is checked below
  sku: z.string().trim().max(SKU_MAX, { message: "products.errors.sku" }),
  gtin: z.string(),
  mpn: z.string().trim().max(MPN_MAX, { message: "products.errors.mpn" }),
  // Its own parcel; empty takes the product's
  weight: measureSchema,
  length: measureSchema,
  width: measureSchema,
  height: measureSchema,
  /** The price goes to every variant of the product. */
  applyAll: z.boolean(),
  /** The product's pictures in their order, with this variant's ties and their alt texts. */
  images: z.array(imageSchema),
})
export type VariantValues = z.infer<typeof variantSchema>
export type VariantField = Exclude<keyof VariantValues, "applyAll" | "images">

/**
 * The variant's rules against what is stored: a barcode typed here must
 * be a GTIN (its check digit fits); one already stored is not refused, so
 * an in-house code never holds up a price change.
 */
export function variantSchemaFor(saved: VariantValues) {
  return variantSchema.superRefine((values, ctx) => {
    const message = typedGtinError(values, saved)
    if (message) {
      ctx.addIssue({ code: "custom", path: ["gtin"], message })
    }
  })
}

export type Variant = NonNullable<ProductDetail["variants"]>[number]
type ProductImage = NonNullable<ProductDetail["images"]>[number]

/** Where each field is in the variant's dialog, in the order its refused values are told. */
export const FIELD_TABS = {
  price: "prices",
  cost: "prices",
  stock: "prices",
  backorder: "prices",
  sku: "codes",
  gtin: "codes",
  mpn: "codes",
  weight: "codes",
  length: "codes",
  width: "codes",
  height: "codes",
} as const satisfies Record<VariantField, string>

/** The variant's level at the shop's default location: what is on the shelf, what is held for orders. */
export function levelAt(variant: Variant, locationId: string | null) {
  const item = variant.inventory_items?.[0]
  const level = item?.inventory?.location_levels?.find((row) => row.location_id === locationId)
  return {
    inventoryItemId: item?.inventory_item_id ?? null,
    stocked: level?.stocked_quantity ?? 0,
    reserved: level?.reserved_quantity ?? 0,
    hasLevel: Boolean(level),
  }
}

/** Its TRY price, or null when it has none. */
export const priceOf = (variant: Variant): number | null => {
  const amount = variant.prices?.find((price) => price.currency_code === CURRENCY)?.amount
  return typeof amount === "number" ? amount : null
}

/** The variants tied to a picture; none means it shows with all of them. */
export const tiedTo = (image: ProductImage): string[] =>
  ((image as { variants?: { id: string }[] | null }).variants ?? []).map((variant) => variant.id)

/** The product's pictures in their order. */
export const sortedImages = (product: ProductDetail): ProductImage[] =>
  [...(product.images ?? [])].sort((a, b) => a.rank - b.rank)

/** The product's pictures as the variant's dialog edits them: in order, tied or not, alt texts. */
export function imagesFor(product: ProductDetail, variantId: string | null): VariantImage[] {
  const media = new Map((product.media_assets ?? []).map((each) => [each.url, each]))
  return sortedImages(product).map((image) => {
    const record = media.get(image.url)
    return {
      key: image.id,
      url: image.url,
      imageId: image.id,
      mediaId: record?.id ?? null,
      alt: record?.alt ?? "",
      tied: variantId !== null && tiedTo(image).includes(variantId),
    }
  })
}

/**
 * The variant as stored: TRY price, stock at the default location,
 * preorder, from the catalog the unit cost and MPN, the codes, its own
 * measures and (`withImages`) the product's pictures as it is tied to them.
 */
export function savedVariant(
  product: ProductDetail,
  variant: Variant,
  locationId: string | null,
  catalog: CatalogVariant | undefined,
  withImages = true
): VariantValues {
  const price = priceOf(variant)
  const cost = catalog?.cost ?? null
  return {
    price: price === null ? "" : formatMoneyInput(price),
    stock: String(levelAt(variant, locationId).stocked),
    backorder: Boolean(variant.allow_backorder),
    cost: cost === null ? "" : formatMoneyInput(cost),
    ...savedCodes(variant, catalog),
    weight: measureText(variant.weight),
    length: measureText(variant.length),
    width: measureText(variant.width),
    height: measureText(variant.height),
    applyAll: false,
    images: withImages ? imagesFor(product, variant.id) : [],
  }
}

type Dirty = Partial<Record<VariantField, boolean>> | undefined

const baseEdit = (variant: Variant) => ({
  variantId: variant.id,
  prices: (variant.prices ?? []).map(({ id, currency_code, amount }) => ({
    id,
    currency_code,
    amount,
  })),
  amount: null,
  stock: null,
  backorder: null,
})

/**
 * What to save of the variant: only what was changed is sent, so an
 * untouched stock is never written back over a newer one. Null when
 * nothing of its own changed.
 */
export function variantEdit(
  variant: Variant,
  values: VariantValues,
  dirty: Dirty,
  locationId: string | null
): VariantEdit | null {
  const stockChanged = Boolean(dirty?.stock) && locationId !== null
  const { codes, ...mpn } = codeEdits(variant, values, dirty)
  const measures: VariantMeasures = Object.fromEntries(
    MEASURES.flatMap(({ name }) =>
      dirty?.[name] ? [[name, parseMeasureInput(values[name]) ?? null]] : []
    )
  )
  const level = levelAt(variant, locationId)
  const edit: VariantEdit = {
    ...baseEdit(variant),
    amount: dirty?.price ? (parseMoneyInput(values.price) ?? 0) : null,
    stock:
      stockChanged && variant.manage_inventory && level.inventoryItemId
        ? {
            inventoryItemId: level.inventoryItemId,
            quantity: Number(values.stock),
            hasLevel: level.hasLevel,
          }
        : null,
    backorder: dirty?.backorder ? values.backorder : null,
    ...(dirty?.cost ? { cost: parseMoneyInput(values.cost) } : {}),
    codes,
    ...mpn,
    measures: Object.keys(measures).length > 0 ? measures : null,
  }
  const changed =
    edit.amount !== null ||
    edit.stock !== null ||
    edit.backorder !== null ||
    "cost" in edit ||
    edit.codes !== null ||
    "mpn" in edit ||
    edit.measures !== null
  return changed ? edit : null
}

/** The same price for another variant ("Tüm varyantlara uygula"); null when it has it already. */
export function priceEdit(variant: Variant, amount: number): VariantEdit | null {
  return priceOf(variant) === amount ? null : { ...baseEdit(variant), amount }
}

/** A field's element id in the dialog: the barcode keeps the advisor's target id. */
export const fieldId = (field: VariantField) =>
  field === "gtin" ? VARIANT_CODES_TARGET : `variant-${field}`

/**
 * The tied pictures in a new order, each keeping the place among the
 * product's pictures that a tied one had: the variant's own order changes,
 * the rest of the gallery does not move.
 */
export function moveTied(images: readonly VariantImage[], key: string, delta: -1 | 1) {
  const slots = images.flatMap((image, at) => (image.tied ? [at] : []))
  const tied = slots.map((slot) => images[slot]).filter((image) => image !== undefined)
  const from = tied.findIndex((image) => image.key === key)
  const to = from + delta
  const moving = tied[from]
  const other = tied[to]
  if (!moving || !other) {
    return [...images]
  }
  tied[from] = other
  tied[to] = moving
  const next = [...images]
  slots.forEach((slot, at) => {
    const image = tied[at]
    if (image) {
      next[slot] = image
    }
  })
  return next
}
