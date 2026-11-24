import { storedAddonsOf } from "../../../lib/catalog/addons"
import type { Restriction } from "../../../lib/catalog"
import type { SetProductCatalogInput } from "../steps/plan-product-catalog"
import type { SeoValues } from "../../seo/entities"

/**
 * A product's copy (owner 2026-11-06, "Kopyala"): what Medusa's create
 * takes and what the catalog, brand, SEO and attribute saves take after
 * it. A draft named "… (kopya)" on a free address; its options, variants
 * and prices, pictures (the same files), categories, type, collection,
 * tags, sales channels and parcel; its descriptions, add-ons, catalog
 * marks and unit costs; its brand, attributes and search texts. Never the
 * codes that must be unique (SKU, EAN, UPC, barcode, MPN), the stock (none
 * yet), the canonical address or the successor.
 */

export const COPY_SUFFIX = " (kopya)"
const TITLE_MAX = 255

export interface SourcePrice {
  amount?: number | string | null
  currency_code?: string | null
  price_list_id?: string | null
  rules_count?: number | null
}

export interface SourceVariant {
  id: string
  title?: string | null
  variant_rank?: number | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  options?: ({ value: string; option_id?: string | null } | null)[] | null
  prices?: (SourcePrice | null)[] | null
  variant_extension?: { cost?: number | null } | null
}

export interface SourceProduct {
  id: string
  title: string
  subtitle?: string | null
  description?: string | null
  thumbnail?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  origin_country?: string | null
  hs_code?: string | null
  mid_code?: string | null
  material?: string | null
  discountable?: boolean | null
  type_id?: string | null
  collection_id?: string | null
  tags?: ({ id: string } | null)[] | null
  categories?: ({ id: string } | null)[] | null
  sales_channels?: ({ id: string } | null)[] | null
  shipping_profile?: { id: string } | null
  images?:
    | ({ url: string; rank?: number | null; variants?: ({ id: string } | null)[] | null } | null)[]
    | null
  options?:
    ({ id: string; title: string; values?: ({ value: string } | null)[] | null } | null)[] | null
  variants?: (SourceVariant | null)[] | null
  brand?: { id: string } | null
  seo_meta?: Partial<SeoValues> | null
  product_extension?: {
    condition?: SetProductCatalogInput["condition"] | null
    kind?: SetProductCatalogInput["kind"] | null
    primary_category_id?: string | null
    withdrawal_excluded?: boolean | null
    restriction?: Restriction | null
    is_gift_card?: boolean | null
    addons?: unknown
    description_doc?: unknown
    summary_doc?: unknown
    badge?: string | null
  } | null
}

/** The shop's flags the copy's marks need: one off leaves that mark out rather than failing. */
export interface CopyFlags {
  giftCards: boolean
  addons: boolean
  restricted: boolean
}

export interface CopyAttributes {
  template_id: string | null
  values: Record<string, string | number | boolean | string[] | null>
}

export interface CopyPlan {
  /** Medusa's `createProductsWorkflow` input for the one product. */
  create: Record<string, unknown>
  /** The variants' pictures (`additional_data.variant_images`), tied in the create's own hook. */
  variantImages: { options: Record<string, string>; image_urls: string[] }[]
  /** The catalog save, without the variants (their ids come with the create). */
  catalog: Omit<SetProductCatalogInput, "product_id" | "variants">
  /** Unit costs in lira by the variant's option values (`optionKey`). */
  costs: Record<string, number>
  brand_id: string | null
  seo: Partial<SeoValues> | null
  attributes: CopyAttributes | null
}

/** "Şef Bıçağı" → "Şef Bıçağı (kopya)", cut so the whole fits a title. */
export const copyTitle = (title: string): string =>
  `${title.trim().slice(0, TITLE_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`

/** A variant's option values as one key, the same for the source and its copy. */
export const optionKey = (options: Record<string, string>): string =>
  JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))

const present = <T>(rows: readonly (T | null | undefined)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null && row !== undefined)

const defined = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined)
  )

/** A variant's option values by option title, as Medusa's create takes them. */
function variantOptions(source: SourceProduct, variant: SourceVariant): Record<string, string> {
  const titles = new Map(present(source.options).map((option) => [option.id, option.title]))
  return Object.fromEntries(
    present(variant.options).flatMap((value) => {
      const title = value.option_id ? titles.get(value.option_id) : undefined
      return title ? [[title, value.value]] : []
    })
  )
}

// Base prices only: a price list's and a rule's (a region's) are the shop's campaigns
const basePrices = (variant: SourceVariant) =>
  present(variant.prices).flatMap((price) => {
    const amount = Number(price.amount)
    const base = !price.price_list_id && !(price.rules_count ?? 0)
    return base && price.currency_code && Number.isFinite(amount)
      ? [{ currency_code: price.currency_code, amount }]
      : []
  })

function catalogOf(source: SourceProduct, flags: CopyFlags): CopyPlan["catalog"] {
  const extension = source.product_extension ?? null
  if (!extension) {
    return {}
  }
  const giftCard = extension.is_gift_card === true && flags.giftCards
  const categories = new Set(present(source.categories).map((category) => category.id))
  const addons = flags.addons ? storedAddonsOf(extension.addons) : []
  const primary = extension.primary_category_id
  return {
    ...(extension.condition ? { condition: extension.condition } : {}),
    // A gift card is digital by its mark: the kind is the mark's to set
    ...(extension.kind && !giftCard ? { kind: extension.kind } : {}),
    // A stale primary category (one the product left) is not carried over
    ...(primary && categories.has(primary) ? { primary_category_id: primary } : {}),
    ...(extension.withdrawal_excluded ? { withdrawal_excluded: true } : {}),
    ...(extension.restriction && flags.restricted ? { restriction: extension.restriction } : {}),
    ...(giftCard ? { is_gift_card: true } : {}),
    // Stored add-ons read as their input, ids kept (a cart line names them per product)
    ...(addons.length > 0 ? { addons: addons } : {}),
    ...(extension.description_doc ? { description_doc: extension.description_doc as never } : {}),
    ...(extension.summary_doc ? { summary_doc: extension.summary_doc as never } : {}),
    ...(extension.badge ? { badge: extension.badge } : {}),
  }
}

function seoOf(source: SourceProduct): Partial<SeoValues> | null {
  const meta = source.seo_meta
  if (!meta) {
    return null
  }
  // The canonical address is the source's own page: never copied
  const values = defined({
    seo_title: meta.seo_title,
    seo_description: meta.seo_description,
    focus_keyword: meta.focus_keyword,
    robots_override: meta.robots_override,
    og_image_override: meta.og_image_override,
    og_image_alt: meta.og_image_alt,
  }) as Partial<SeoValues>
  return Object.keys(values).length > 0 ? values : null
}

/** The copy of `source` at `handle`, with what the shop's flags allow. */
export function copyPlan(
  source: SourceProduct,
  handle: string,
  flags: CopyFlags,
  attributes: CopyAttributes | null = null
): CopyPlan {
  const variants = present(source.variants).sort(
    (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )
  const images = present(source.images).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const optionsById = new Map(
    variants.map((variant) => [variant.id, variantOptions(source, variant)])
  )
  const variantImages = variants.flatMap((variant) => {
    const urls = images
      .filter((image) => present(image.variants).some((each) => each.id === variant.id))
      .map((image) => image.url)
    return urls.length > 0 ? [{ options: optionsById.get(variant.id) ?? {}, image_urls: urls }] : []
  })
  const costs = Object.fromEntries(
    variants.flatMap((variant) => {
      const cost = variant.variant_extension?.cost
      return typeof cost === "number"
        ? [[optionKey(optionsById.get(variant.id) ?? {}), cost / 100]]
        : []
    })
  )
  const ids = (rows: SourceProduct["tags"]) => present(rows).map((row) => ({ id: row.id }))
  const create = {
    title: copyTitle(source.title),
    handle,
    status: "draft",
    ...defined({
      subtitle: source.subtitle,
      description: source.description,
      thumbnail: source.thumbnail,
      weight: source.weight,
      length: source.length,
      width: source.width,
      height: source.height,
      origin_country: source.origin_country,
      hs_code: source.hs_code,
      mid_code: source.mid_code,
      material: source.material,
      discountable: source.discountable,
      type_id: source.type_id,
      collection_id: source.collection_id,
      shipping_profile_id: source.shipping_profile?.id,
    }),
    images: images.map((image) => ({ url: image.url })),
    tags: ids(source.tags),
    categories: ids(source.categories),
    sales_channels: ids(source.sales_channels),
    options: present(source.options).map((option) => ({
      title: option.title,
      values: present(option.values).map((value) => value.value),
    })),
    variants: variants.map((variant, index) => ({
      title: variant.title ?? source.title,
      variant_rank: variant.variant_rank ?? index,
      manage_inventory: variant.manage_inventory ?? true,
      allow_backorder: variant.allow_backorder ?? false,
      ...defined({
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
      }),
      options: optionsById.get(variant.id) ?? {},
      prices: basePrices(variant),
    })),
  }
  return {
    create,
    variantImages,
    catalog: catalogOf(source, flags),
    costs,
    brand_id: source.brand?.id ?? null,
    seo: seoOf(source),
    attributes:
      attributes && (attributes.template_id || Object.keys(attributes.values).length > 0)
        ? attributes
        : null,
  }
}
