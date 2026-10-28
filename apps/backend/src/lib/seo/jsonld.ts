/**
 * Structured data blocks (docs/13 §5, F3.12): what search engines read of
 * a page, built from the same facts the page and the feeds use. Pure: the
 * caller gathers the facts. URLs are absolute (the caller has the host);
 * prices are numeric strings without a symbol; availability and condition
 * are full schema.org URLs. The storefront escapes `<` when it prints
 * them (F18).
 */
import { shippingDetailsOf } from "./jsonld-shipping"
import type { DeliveryFacts } from "./jsonld-shipping"

export type JsonLd = Record<string, unknown>

const SCHEMA = "https://schema.org"

export const AVAILABILITIES = ["InStock", "OutOfStock", "BackOrder", "PreOrder"] as const
export type Availability = (typeof AVAILABILITIES)[number]

// Catalog conditions (F3.1) as schema.org's item conditions
const CONDITIONS = {
  new: "NewCondition",
  refurbished: "RefurbishedCondition",
  used: "UsedCondition",
  damaged: "DamagedCondition",
} as const
export type Condition = keyof typeof CONDITIONS

/** Google reads only these in `variesBy` (docs/13 §2.3). */
export const VARIES_BY_PROPERTIES = [
  "color",
  "size",
  "suggestedAge",
  "suggestedGender",
  "material",
  "pattern",
] as const
export type VariesBy = (typeof VARIES_BY_PROPERTIES)[number]

export interface VariantFacts {
  id: string
  /** The variant's own name ("Keten Gömlek – M"). */
  name: string
  sku: string | null
  gtin: string | null
  mpn: string | null
  image: string | null
  /** Gross TRY price the shopper pays now; null when the variant has none (no offer then). */
  price: number | null
  /**
   * The price shown struck through beside it (F4.3): set only when the
   * 30-day rule lets the price be shown as a discount (ADR-0023).
   */
  strikethrough?: number | null
  availability: Availability
  /** The values of the properties the group varies by ({ size: "M" }). */
  properties: Partial<Record<VariesBy, string>>
  /** Gross TRY the shop charges to ship one (its price table, F7.8); null: not known. */
  shippingRate?: number | null
}

export type { DeliveryFacts } from "./jsonld-shipping"

export interface ProductFacts {
  name: string
  description: string
  /** Absolute URLs, the main one first. */
  images: string[]
  brand: string | null
  condition: Condition
  /** A stable id for the group (the product's handle). */
  groupId: string
  variesBy: VariesBy[]
  variants: VariantFacts[]
  /** How long an order takes; with a variant's shipping rate it makes `shippingDetails`. */
  delivery?: DeliveryFacts | null
  /** Approved reviews (F10.6): `aggregateRating`, only when the page shows them. */
  rating?: { average: number; count: number } | null
}

/** The stars a product's page shows, as Google reads them; none without a review. */
const aggregateRating = (rating: ProductFacts["rating"]): JsonLd | undefined =>
  rating && rating.count > 0
    ? {
        "@type": "AggregateRating",
        ratingValue: rating.average.toFixed(1),
        reviewCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      }
    : undefined

export interface ListingFacts {
  name: string
  description: string
  /** The first page of products, as the storefront lists them. */
  items: { name: string; url: string }[]
}

const price = (amount: number): string => amount.toFixed(2)

function offerOf(
  variant: VariantFacts,
  url: string,
  condition: Condition,
  delivery?: DeliveryFacts | null
): JsonLd | null {
  if (variant.price === null || !(variant.price > 0)) {
    return null
  }
  const struck =
    variant.strikethrough && variant.strikethrough > variant.price ? variant.strikethrough : null
  return {
    "@type": "Offer",
    url,
    price: price(variant.price),
    priceCurrency: "TRY",
    // The price before the discount, as the storefront shows it struck through (docs/13)
    ...(struck === null
      ? {}
      : {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            priceType: `${SCHEMA}/StrikethroughPrice`,
            price: price(struck),
            priceCurrency: "TRY",
          },
        }),
    availability: `${SCHEMA}/${variant.availability}`,
    itemCondition: `${SCHEMA}/${CONDITIONS[condition]}`,
    // Only with a rate the shop's table gives: a guessed rate would mislead (docs/13 §5)
    ...(delivery && typeof variant.shippingRate === "number"
      ? { shippingDetails: shippingDetailsOf(variant.shippingRate, delivery) }
      : {}),
  }
}

const compact = (block: JsonLd): JsonLd =>
  Object.fromEntries(
    Object.entries(block).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0)
    )
  )

function variantProduct(
  facts: ProductFacts,
  variant: VariantFacts,
  url: string,
  single: boolean
): JsonLd {
  const offer = offerOf(variant, url, facts.condition, facts.delivery)
  return compact({
    "@type": "Product",
    ...(single ? { "@context": SCHEMA } : {}),
    name: single ? facts.name : variant.name,
    description: single ? facts.description : undefined,
    sku: variant.sku,
    gtin: variant.gtin,
    mpn: variant.mpn,
    image: single ? facts.images : variant.image ? [variant.image] : facts.images.slice(0, 1),
    brand: single && facts.brand ? { "@type": "Brand", name: facts.brand } : undefined,
    ...variant.properties,
    offers: offer,
    aggregateRating: single ? aggregateRating(facts.rating) : undefined,
  })
}

/**
 * A product page's block: `Product` for one variant, `ProductGroup` with
 * a `Product` per variant otherwise, each with its own `Offer`. A variant
 * is preselected by `?variant=` (docs/13 §2.3), so its offer URL says so.
 */
export function productJsonLd(facts: ProductFacts, url: string): JsonLd {
  const [only] = facts.variants
  if (facts.variants.length === 1 && only) {
    return variantProduct(facts, only, url, true)
  }
  return compact({
    "@context": SCHEMA,
    "@type": "ProductGroup",
    name: facts.name,
    description: facts.description,
    image: facts.images,
    brand: facts.brand ? { "@type": "Brand", name: facts.brand } : undefined,
    productGroupID: facts.groupId,
    aggregateRating: aggregateRating(facts.rating),
    variesBy: facts.variesBy.map((property) => `${SCHEMA}/${property}`),
    hasVariant: facts.variants.map((variant) =>
      variantProduct(facts, variant, `${url}?variant=${encodeURIComponent(variant.id)}`, false)
    ),
  })
}

/** A category, brand or collection page: what it is and the products it lists first. */
export function listingJsonLd(facts: ListingFacts, url: string): JsonLd {
  return compact({
    "@context": SCHEMA,
    "@type": "CollectionPage",
    name: facts.name,
    description: facts.description,
    url,
    mainEntity:
      facts.items.length > 0
        ? {
            "@type": "ItemList",
            itemListElement: facts.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: item.url,
              name: item.name,
            })),
          }
        : undefined,
  })
}

export function breadcrumbJsonLd(crumbs: readonly { name: string; url: string }[]): JsonLd | null {
  if (crumbs.length < 2) {
    return null
  }
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

/** A content page's or blog post's facts (F3.16, docs/13 §5). */
export interface ArticleFacts {
  /** A blog post is a `BlogPosting`; a content page (about, delivery terms) a `WebPage`. */
  type: "BlogPosting" | "WebPage"
  headline: string
  description: string
  /** ISO dates: first published, last changed in its text. */
  datePublished: string | null
  dateModified: string | null
  author: string | null
  image: string | null
  publisher: string
}

export function articleJsonLd(facts: ArticleFacts, url: string): JsonLd {
  if (facts.type === "WebPage") {
    return compact({
      "@context": SCHEMA,
      "@type": "WebPage",
      name: facts.headline,
      description: facts.description,
      url,
      dateModified: facts.dateModified ?? facts.datePublished,
    })
  }
  return compact({
    "@context": SCHEMA,
    "@type": "BlogPosting",
    headline: facts.headline,
    description: facts.description,
    url,
    mainEntityOfPage: url,
    image: facts.image ? [facts.image] : undefined,
    datePublished: facts.datePublished,
    dateModified: facts.dateModified ?? facts.datePublished,
    author: facts.author ? { "@type": "Person", name: facts.author } : undefined,
    publisher: { "@type": "Organization", name: facts.publisher },
  })
}

/**
 * The home page's blocks (docs/13 §5): the shop as an `OnlineStore` (the
 * most specific organisation type for a web shop) and the `WebSite`
 * without a search action (Google dropped the sitelinks search box).
 */
export function siteJsonLd(shop: { name: string; url: string; logo: string | null }): JsonLd[] {
  return [
    compact({
      "@context": SCHEMA,
      "@type": "OnlineStore",
      name: shop.name,
      url: shop.url,
      logo: shop.logo,
    }),
    { "@context": SCHEMA, "@type": "WebSite", name: shop.name, url: shop.url },
  ]
}
