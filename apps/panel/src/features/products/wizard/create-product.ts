import { useMutation, useQueryClient } from "@tanstack/react-query"
import { normalizeGtin } from "@/lib/gtin"
import { sdk } from "@/lib/sdk"
import { parseMeasureInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import type { ShopDefaults } from "@/features/products/api/lookups"
import type { JSONContent } from "@tiptap/react"
import type { AttributeValue } from "@/features/attributes/types"
import { hasSummaryText } from "@/features/products/summary-doc"
import { DEFAULT_VARIANT_KEY } from "./schema"
import type { WizardValues } from "./schema"
import { ownImageUrls } from "./variant-draft"

const CURRENCY = "try"

interface CreateInput {
  values: WizardValues
  publish: boolean
  defaults: ShopDefaults
  /** The option and value a product without options gets (Medusa needs one). */
  defaultOption: { title: string; value: string }
}

const measure = (text: string) => {
  const value = parseMeasureInput(text)
  return value && value > 0 ? value : undefined
}

const MEASURES = ["weight", "length", "width", "height"] as const

// The measures given (more than nothing), as numbers; an empty one is left to the product's parcel
const measuresOf = (texts: Record<(typeof MEASURES)[number], string>) =>
  Object.fromEntries(
    MEASURES.flatMap((field) => {
      const value = measure(texts[field])
      return value === undefined ? [] : [[field, value]]
    })
  )

type Row = WizardValues["variants"][number]

/**
 * Each variant's own pictures, sent with the product (`additional_data`):
 * neither has an id yet, so the variant goes by its option values and the
 * picture by its address. The server ties them in the create's own
 * workflow; a tie it cannot make undoes the product.
 */
export function variantImages(
  values: Pick<WizardValues, "images" | "variants">,
  optionsOf: (row: Row) => Record<string, string>
): { options: Record<string, string>; image_urls: string[] }[] {
  return values.variants.flatMap((row) => {
    const urls = ownImageUrls(row, values.images)
    return urls.length > 0 ? [{ options: optionsOf(row), image_urls: urls }] : []
  })
}

export function productBody({ values, defaults, defaultOption }: CreateInput) {
  const options =
    values.has_options && values.options.length > 0
      ? values.options.map((option) => ({ title: option.title, values: option.values }))
      : [{ title: defaultOption.title, values: [defaultOption.value] }]
  const optionsOf = (variant: Row) =>
    variant.key === DEFAULT_VARIANT_KEY
      ? { [defaultOption.title]: defaultOption.value }
      : variant.options
  const ties = variantImages(values, optionsOf)
  return {
    title: values.title.trim(),
    ...(values.handle.trim() ? { handle: values.handle.trim() } : {}),
    description: values.description.trim(),
    // Always a draft first: it is published last, once its kind (F3.2) and
    // attributes are written, so a failed step never leaves it live half-made
    status: "draft" as const,
    images: values.images.map((image) => ({ url: image.url })),
    ...(values.images[0] ? { thumbnail: values.images[0].url } : {}),
    categories: values.category_ids.map((id) => ({ id })),
    ...(values.type_id ? { type_id: values.type_id } : {}),
    ...(defaults.shippingProfileId && values.kind === "physical"
      ? { shipping_profile_id: defaults.shippingProfileId }
      : {}),
    ...(defaults.salesChannelId ? { sales_channels: [{ id: defaults.salesChannelId }] } : {}),
    ...measuresOf(values),
    options,
    variants: values.variants.map((variant, index) => ({
      title: variant.key === DEFAULT_VARIANT_KEY ? values.title.trim() : variant.title,
      // The order the options were typed in (S, M, L), kept on the product page
      variant_rank: index,
      ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
      ...(variant.ean.trim() ? { ean: normalizeGtin(variant.ean) } : {}),
      // Its own parcel (adr/0054); a single variant's is the product's
      ...(variant.key === DEFAULT_VARIANT_KEY ? {} : measuresOf(variant)),
      manage_inventory: values.manage_inventory,
      allow_backorder: values.allow_backorder,
      prices: [{ currency_code: CURRENCY, amount: parseMoneyInput(variant.price) ?? 0 }],
      options: optionsOf(variant),
    })),
    ...(ties.length > 0 ? { additional_data: { variant_images: ties } } : {}),
  }
}

interface CatalogBody {
  kind?: WizardValues["kind"]
  booking_mode?: "departure"
  summary_doc?: JSONContent
  variants?: Record<string, { cost?: number; mpn?: string }>
}

/**
 * What the new product's catalog fields take, in one save: a digital or
 * service kind (F3.2; before it is published), the short description as
 * written (ADR-0055 Ek 2026-11-06) and its variants' unit costs and MPNs
 * (F11.4), by the ids the product was saved with (`variantIds`, in the
 * rows' order). Null when there is none of them.
 */
export function catalogBody(
  values: Pick<WizardValues, "kind" | "summary_doc"> &
    Partial<Pick<WizardValues, "variants" | "booking_mode">>,
  variantIds: readonly (string | undefined)[] = []
): CatalogBody | null {
  const variants = Object.fromEntries(
    (values.variants ?? []).flatMap((row, index) => {
      const id = variantIds[index]
      const cost = row.cost.trim() === "" ? null : parseMoneyInput(row.cost)
      const entry = {
        ...(cost === null ? {} : { cost }),
        ...(row.mpn.trim() ? { mpn: row.mpn.trim() } : {}),
      }
      return id && Object.keys(entry).length > 0 ? [[id, entry]] : []
    })
  )
  const body: CatalogBody = {
    ...(values.kind === "physical" ? {} : { kind: values.kind }),
    // adr/0076 §2: sold by departure, saved with its kind (the server checks the flag)
    ...(values.kind === "service" && values.booking_mode === "departure"
      ? { booking_mode: "departure" as const }
      : {}),
    ...(hasSummaryText(values.summary_doc) ? { summary_doc: values.summary_doc } : {}),
    ...(Object.keys(variants).length > 0 ? { variants } : {}),
  }
  return Object.keys(body).length > 0 ? body : null
}

/** The saved variants' ids in the rows' order, found by the title each row was saved with. */
function idsByRow(
  values: WizardValues,
  saved: readonly { id: string; title?: string | null }[] | null | undefined
): (string | undefined)[] {
  const byTitle = new Map((saved ?? []).map((variant) => [variant.title ?? "", variant.id]))
  return values.variants.map((row) =>
    byTitle.get(row.key === DEFAULT_VARIANT_KEY ? values.title.trim() : row.title)
  )
}

// The stock typed per variant, at the shop's default location. A variant made to sell
// past stock already has its (empty) level there from the server: that one is updated.
async function stockLevels(productId: string, values: WizardValues, locationId: string) {
  const { product } = await sdk.admin.product.retrieve(productId, {
    fields:
      "variants.id,variants.title,variants.inventory_items.inventory_item_id," +
      "variants.inventory_items.inventory.location_levels.location_id",
  })
  const stockByTitle = new Map(
    values.variants.map((variant) => [
      variant.key === DEFAULT_VARIANT_KEY ? values.title.trim() : variant.title,
      Number(variant.stock),
    ])
  )
  const rows = (product.variants ?? []).flatMap((variant) =>
    (variant.inventory_items ?? []).map((item) => ({
      level: {
        inventory_item_id: item.inventory_item_id,
        location_id: locationId,
        stocked_quantity: stockByTitle.get(variant.title ?? "") ?? 0,
      },
      exists: (item.inventory?.location_levels ?? []).some(
        (level) => level.location_id === locationId
      ),
    }))
  )
  if (rows.length > 0) {
    await sdk.admin.inventoryItem.batchInventoryItemsLocationLevels({
      create: rows.filter((row) => !row.exists).map((row) => row.level),
      update: rows.filter((row) => row.exists).map((row) => row.level),
    })
  }
}

/**
 * The new product's attribute template and its filled values (adr/0013),
 * or null without a template. An empty field is left out: it was never
 * given. The server checks each value against its definition.
 */
export function attributesBody(
  values: Pick<WizardValues, "template_id" | "attributes">
): { template_id: string; values: Record<string, AttributeValue> } | null {
  if (!values.template_id) {
    return null
  }
  const filled = Object.entries(values.attributes).filter(
    ([, value]) => value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)
  )
  return {
    template_id: values.template_id,
    values: Object.fromEntries(filled),
  }
}

export interface CreateResult {
  productId: string
  /**
   * The product was saved but its stock was not: the shop has no default
   * location, or writing the levels failed (with why). The page says so.
   */
  stockProblem: { kind: "no_location" } | { kind: "failed"; reason: unknown } | null
  /** The product was saved but its attributes were not (a required one empty): why. */
  attributesProblem: { reason: unknown } | null
  /**
   * Publishing was asked but the product stays a draft: its attributes were
   * not written (`attributesProblem`), or publishing itself failed (why).
   */
  publishHeld: { reason: unknown } | null
}

type StockProblem = CreateResult["stockProblem"]

/**
 * Creates the product as a draft, then writes its catalog fields and
 * attributes, and publishes it last when asked: an attribute write that
 * fails keeps it a draft (`publishHeld`). Stock follows; its failure leaves
 * the product as it is.
 */
export async function createProduct(input: CreateInput): Promise<CreateResult> {
  const { product } = await sdk.admin.product.create(productBody(input))
  const path = `/admin/products/${encodeURIComponent(product.id)}`
  const catalog = catalogBody(input.values, idsByRow(input.values, product.variants))
  if (catalog) {
    await sdk.client.fetch(`${path}/catalog`, { method: "POST", body: catalog })
  }
  let attributesProblem: CreateResult["attributesProblem"] = null
  const attributes = attributesBody(input.values)
  if (attributes) {
    try {
      await sdk.client.fetch(`${path}/attributes`, { method: "POST", body: attributes })
    } catch (reason) {
      // The product stands as a draft; its attributes are filled on its page
      attributesProblem = { reason }
    }
  }
  let publishHeld: CreateResult["publishHeld"] = null
  if (input.publish) {
    if (attributesProblem) {
      publishHeld = attributesProblem
    } else {
      try {
        await sdk.admin.product.update(product.id, { status: "published" })
      } catch (reason) {
        publishHeld = { reason }
      }
    }
  }
  return {
    productId: product.id,
    stockProblem: await stockOf(product.id, input),
    attributesProblem,
    publishHeld,
  }
}

// The stock typed, at the shop's default location; a failure leaves the product standing
async function stockOf(productId: string, input: CreateInput): Promise<StockProblem> {
  if (!input.values.manage_inventory) {
    return null
  }
  if (!input.defaults.locationId) {
    return { kind: "no_location" }
  }
  try {
    await stockLevels(productId, input.values, input.defaults.locationId)
    return null
  } catch (reason) {
    // The product stands; its stock is set on its page
    return { kind: "failed", reason }
  }
}

/** `createProduct` as a mutation; the product lists are read again after it. */
export function useCreateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
