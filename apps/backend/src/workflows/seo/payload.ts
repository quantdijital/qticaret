import type { MedusaContainer } from "@medusajs/framework/types"
import {
  SHORT_EXCERPT,
  excerpt,
  plainText,
  priceSentence,
  resolveSeoPayload,
  shippingSentence,
} from "../../lib/seo/resolve"
import { deepestCategory } from "../../lib/catalog"
import type { SeoPayload, SeoSubject } from "../../lib/seo/resolve"
import type { UrlOwner } from "../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { priceDisplays } from "../pricing/price-display"
import { shopShippingOptions } from "../shipping/shop-options"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { PRODUCT_FACT_FIELDS, productFacts } from "./facts"
import type { FactRow, ShippingFacts } from "./facts"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ShippingSettings, StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { Condition } from "../../lib/seo/jsonld"
import { highlightText } from "./highlight"
import { contentSubject, landingSubject } from "./payload-content"
import type { HighlightValue } from "./highlight"
import {
  MEDIA_FIELDS,
  SEO_FIELDS,
  imageOf,
  listingItems,
  mainImageOf,
  rowOf,
  shopOf,
  trailOf,
} from "./payload-sources"
import type { MediaRow } from "./payload-sources"
import type { CategoryRow, SeoMetaRow } from "./payload-sources"

/**
 * Loads what a page's `seo` object needs (adr/0015) and builds it with
 * `lib/seo/resolve`: the record, its own SEO fields, the shop's settings,
 * its trail of categories and its share image.
 */

interface ProductRow extends Omit<FactRow, "product_extension"> {
  id: string
  subtitle?: string | null
  description?: string | null
  categories?: (CategoryRow | null)[] | null
  product_extension?: { primary_category_id?: string | null; condition?: Condition | null } | null
  attribute_values?: (HighlightValue | null)[] | null
  brand?: { name: string } | null
  media_assets?: (MediaRow | null)[] | null
  seo_meta?: SeoMetaRow | null
}

// The primary category, else the deepest one the product is in (docs/13 §2.2)
function primaryCategory(product: ProductRow): CategoryRow | null {
  const categories = (product.categories ?? []).filter((row): row is CategoryRow => row !== null)
  const chosen = product.product_extension?.primary_category_id
  return categories.find((row) => row.id === chosen) ?? deepestCategory(categories) ?? null
}

/**
 * The shop's shipping rules and product units, for offers and the
 * shipping sentence (F7.8), and whether shoppers see an option the table
 * prices.
 */
async function shippingFactsOf(container: MedusaContainer): Promise<ShippingFacts> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [shipping, store, options] = await Promise.all([
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
    settings.getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    shopShippingOptions(container),
  ])
  return {
    settings: shipping,
    units: { weight_unit: store.weight_unit, dimension_unit: store.dimension_unit },
    table_offered: options.some((option) => option.pricing === "table" && option.in_store),
  }
}

async function productSubject(container: MedusaContainer, id: string, path: string) {
  const product = await rowOf<ProductRow>(
    container,
    "product",
    [
      "id",
      "title",
      "subtitle",
      "description",
      "thumbnail",
      "categories.id",
      "categories.name",
      "categories.mpath",
      "product_extension.primary_category_id",
      ...PRODUCT_FACT_FIELDS,
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
      "attribute_values.*",
      "attribute_values.definition.*",
      "brand.name",
      ...MEDIA_FIELDS,
      ...SEO_FIELDS,
    ],
    id
  )
  if (!product) {
    return null
  }
  const category = primaryCategory(product)
  const description = product.description ?? ""
  const subtitle = product.subtitle?.trim() ?? ""
  // The price the shopper pays now and, where the 30-day rule allows, the one struck through
  const displays = await priceDisplays(
    container,
    (product.variants ?? []).flatMap((variant) => (variant ? [variant.id] : [])),
    "try"
  )
  const shipping = await shippingFactsOf(container)
  const facts = {
    ...productFacts(
      product,
      product.brand?.name ?? null,
      plainText(description),
      displays,
      shipping
    ),
    // F10.6: the stars of the approved reviews the page shows
    rating:
      (
        await container
          .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
          .ratingsOf([product.id])
      ).get(product.id) ?? null,
  }
  const subject: SeoSubject = {
    kind: "product",
    path,
    name: product.title,
    description,
    tokens: {
      kategori: category?.name ?? null,
      kısa_açıklama: subtitle !== "" ? subtitle : excerpt(description, SHORT_EXCERPT),
      fiyat_cümlesi: priceSentence(facts.variants.flatMap((variant) => variant.price ?? [])),
      öne_çıkan_attribute: highlightText(product.attribute_values ?? []),
      marka: product.brand?.name ?? null,
      kargo_cümlesi: shippingSentence(
        shipping.settings.handling_days_min,
        shipping.settings.handling_days_max
      ),
    },
    overrides: product.seo_meta ?? null,
    image: await imageOf(
      container,
      product.seo_meta,
      mainImageOf(product.thumbnail, product.media_assets)
    ),
    trail: category ? await trailOf(container, category, true) : [],
    product: facts,
  }
  return subject
}

async function categorySubject(container: MedusaContainer, id: string, path: string) {
  const category = await rowOf<CategoryRow>(
    container,
    "product_category",
    ["id", "name", "description", "mpath", ...SEO_FIELDS],
    id
  )
  if (!category) {
    return null
  }
  const subject: SeoSubject = {
    kind: "category",
    path,
    name: category.name,
    description: category.description ?? "",
    tokens: {},
    overrides: category.seo_meta ?? null,
    image: await imageOf(container, category.seo_meta, null),
    trail: await trailOf(container, category, false),
    listing: await listingItems(container, {
      entity_type: CATALOG_ENTITY_TYPES.category,
      entity_id: id,
    }),
  }
  return subject
}

async function collectionSubject(container: MedusaContainer, id: string, path: string) {
  const collection = await rowOf<{ id: string; title: string; seo_meta?: SeoMetaRow | null }>(
    container,
    "product_collection",
    ["id", "title", ...SEO_FIELDS],
    id
  )
  if (!collection) {
    return null
  }
  const subject: SeoSubject = {
    kind: "collection",
    path,
    name: collection.title,
    description: "",
    tokens: {},
    overrides: collection.seo_meta ?? null,
    image: await imageOf(container, collection.seo_meta, null),
    trail: [],
    listing: await listingItems(container, {
      entity_type: CATALOG_ENTITY_TYPES.collection,
      entity_id: id,
    }),
  }
  return subject
}

async function brandSubject(container: MedusaContainer, id: string, path: string) {
  const brand = await rowOf<{
    id: string
    name: string
    description?: string | null
    logo_url?: string | null
    seo_meta?: SeoMetaRow | null
  }>(container, "brand", ["id", "name", "description", "logo_url", ...SEO_FIELDS], id)
  if (!brand) {
    return null
  }
  const subject: SeoSubject = {
    kind: "brand",
    path,
    name: brand.name,
    description: brand.description ?? "",
    tokens: {},
    overrides: brand.seo_meta ?? null,
    image: await imageOf(container, brand.seo_meta, brand.logo_url),
    trail: [],
    listing: await listingItems(container, {
      entity_type: CATALOG_ENTITY_TYPES.brand,
      entity_id: id,
    }),
  }
  return subject
}

const SUBJECTS: Readonly<
  Record<
    string,
    (container: MedusaContainer, id: string, path: string) => Promise<SeoSubject | null>
  >
> = {
  [CATALOG_ENTITY_TYPES.product]: productSubject,
  [CATALOG_ENTITY_TYPES.category]: categorySubject,
  [CATALOG_ENTITY_TYPES.collection]: collectionSubject,
  [CATALOG_ENTITY_TYPES.brand]: brandSubject,
  [CATALOG_ENTITY_TYPES.page]: contentSubject,
  [CATALOG_ENTITY_TYPES.post]: contentSubject,
  [CATALOG_ENTITY_TYPES.landing]: landingSubject,
}

/** The `seo` object of a live page at `path`, or null for a kind without one. */
export async function seoPayloadFor(
  container: MedusaContainer,
  owner: UrlOwner,
  path: string
): Promise<SeoPayload | null> {
  const load = Object.hasOwn(SUBJECTS, owner.entity_type) ? SUBJECTS[owner.entity_type] : undefined
  if (!load) {
    return null
  }
  const [subject, shop] = await Promise.all([
    load(container, owner.entity_id, path),
    shopOf(container),
  ])
  return subject ? resolveSeoPayload(subject, shop) : null
}
