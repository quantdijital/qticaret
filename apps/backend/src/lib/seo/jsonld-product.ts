/**
 * A product page's block (docs/13 §5, F3.12): `Product` or `ProductGroup`
 * with an `Offer` per variant, from the facts the page and the feeds use.
 */
import { SCHEMA, compact } from "./jsonld-base"
import type { JsonLd } from "./jsonld-base"
import { shippingDetailsOf } from "./jsonld-shipping"
import type { DeliveryFacts } from "./jsonld-shipping"

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
  /** Units available to sell; null when the variant keeps no stock count (feeds, F10.8). */
  stock?: number | null
  /** One unit's parcel in desi; null without its measures (feeds, F10.8). */
  desi?: number | null
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
  /** The shop's return policy for this product (F13.6): `hasMerchantReturnPolicy`. */
  returnPolicy?: ReturnPolicyFacts | null
  /** Sold to adults only (F13.4): schema.org's consideration, `hasAdultConsideration`. */
  adultConsideration?: string | null
}

export interface ReturnPolicyFacts {
  /** The withdrawal period in days. */
  days: number
  /** The shop pays to send it back. */
  freeReturn: boolean
  /** Outside the right of withdrawal (hygiene, made to order). */
  excluded: boolean
}

/** Google's `MerchantReturnPolicy` for Türkiye, as the shop's settings make it (docs/13 §5). */
const returnPolicyOf = (policy: ReturnPolicyFacts): JsonLd =>
  policy.excluded
    ? {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TR",
        returnPolicyCategory: `${SCHEMA}/MerchantReturnNotPermitted`,
      }
    : {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TR",
        returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
        merchantReturnDays: policy.days,
        returnMethod: `${SCHEMA}/ReturnByMail`,
        returnFees: `${SCHEMA}/${policy.freeReturn ? "FreeReturn" : "ReturnFeesCustomerResponsibility"}`,
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

const price = (amount: number): string => amount.toFixed(2)

function offerOf(
  variant: VariantFacts,
  url: string,
  condition: Condition,
  delivery?: DeliveryFacts | null,
  returns?: ReturnPolicyFacts | null
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
    ...(returns ? { hasMerchantReturnPolicy: returnPolicyOf(returns) } : {}),
  }
}

function variantProduct(
  facts: ProductFacts,
  variant: VariantFacts,
  url: string,
  single: boolean
): JsonLd {
  const offer = offerOf(variant, url, facts.condition, facts.delivery, facts.returnPolicy)
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
    hasAdultConsideration: facts.adultConsideration ?? undefined,
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
    hasAdultConsideration: facts.adultConsideration ?? undefined,
    variesBy: facts.variesBy.map((property) => `${SCHEMA}/${property}`),
    hasVariant: facts.variants.map((variant) =>
      variantProduct(facts, variant, `${url}?variant=${encodeURIComponent(variant.id)}`, false)
    ),
  })
}
