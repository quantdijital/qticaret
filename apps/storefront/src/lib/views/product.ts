import type {
  BreadcrumbView,
  ProductCardView,
  ProductPageView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import type { PriceDisplay, SeoPayload, StoreProduct } from "@qticaret/types"
import { productImages } from "./image"
import { cardPrice, isAvailable, variantPrice } from "./price"
import { specsOf } from "./specs"
import { paragraphsOf, pathOf } from "./text"

/** A price in kuruş, for the add-ons' running total only (adr/0052); null without one. */
const kurusOf = (amount: number | null | undefined): number | null =>
  typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) : null

/** What the shop shows on its cards (adr/0053 §B, `product_card`). */
export interface CardOptions {
  showBrand: boolean
}

const ALL_SHOWN: CardOptions = { showBrand: true }

/** A product in a grid; one without a live path is left out by the caller. */
export function productCard(
  product: StoreProduct,
  path: string,
  displays: Record<string, PriceDisplay>,
  options: CardOptions = ALL_SHOWN
): ProductCardView {
  const variants = product.variants ?? []
  return {
    id: product.id,
    title: product.title,
    path,
    brand: options.showBrand ? (product.brand?.name ?? null) : null,
    image: productImages(product)[0] ?? null,
    price: cardPrice(variants, displays),
    available: variants.some(isAvailable),
  }
}

/** Cards in the order given, for the products that have a path. */
export function productCards(
  products: readonly StoreProduct[],
  paths: Record<string, string>,
  displays: Record<string, PriceDisplay>,
  options: CardOptions = ALL_SHOWN
): ProductCardView[] {
  return products.flatMap((product) => {
    const path = paths[product.id]
    return path ? [productCard(product, path, displays, options)] : []
  })
}

/** The page's trail from its seo object: the backend's names and paths, the last one current. */
export function breadcrumbsOf(
  seo: SeoPayload | null | undefined,
  home: string,
  current: string
): BreadcrumbView[] {
  const crumbs = seo?.breadcrumbs ?? []
  if (crumbs.length === 0) {
    return [
      { label: home, path: "/" },
      { label: current, path: null },
    ]
  }
  return [
    { label: home, path: "/" },
    ...crumbs.map((crumb, index) => ({
      label: crumb.name,
      path: index === crumbs.length - 1 ? null : pathOf(crumb.url),
    })),
  ]
}

interface ProductPageInput {
  product: StoreProduct
  seo: SeoPayload | null | undefined
  displays: Record<string, PriceDisplay>
  brandPath: string | null
  /** `?variant=` from the address (docs/13 §2.3). */
  requestedVariant: string | null
  /** The storefront's words: the trail's first step, yes/no in the specs. */
  t: Translate
  /** The shop's promises, shown beside the cart form. */
  trustBadges: TrustBadgeView[]
  /** The shop's colour names: matching option values show as swatches. */
  swatchOf?: (value: string) => string | null
  /** The backend's HTML of the product's content document (adr/0055); null or left out: none. */
  descriptionHtml?: string | null
}

/** What the product itself says; the page adds its reviews, questions and neighbours. */
export type ProductPageBase = Omit<
  ProductPageView,
  "reviews" | "questions" | "related" | "whatsappHref" | "signedIn" | "loginPath" | "shippingNote"
>

export function productPage({
  product,
  seo,
  displays,
  brandPath,
  requestedVariant,
  t,
  trustBadges,
  swatchOf,
  descriptionHtml = null,
}: ProductPageInput): ProductPageBase {
  const variants = product.variants ?? []
  const options = (product.options ?? []).map((option) => {
    const values = (option.values ?? []).map((value) => value.value)
    const swatches = Object.fromEntries(
      values.flatMap((value) => {
        const hex = swatchOf?.(value)
        return hex ? [[value, hex]] : []
      })
    )
    return {
      id: option.id,
      title: option.title,
      values,
      ...(Object.keys(swatches).length > 0 ? { swatches } : {}),
    }
  })
  // A variant's option values are the product option's own value records:
  // matched by their id (the Store answer may leave `option_id` out)
  const optionOfValue = new Map(
    (product.options ?? []).flatMap((option) =>
      (option.values ?? []).map((value) => [value.id, option.id])
    )
  )
  const views = variants.map((variant) => ({
    id: variant.id,
    title: variant.title ?? product.title,
    options: Object.fromEntries(
      (variant.options ?? []).flatMap((value) => {
        const optionId = value.option_id ?? optionOfValue.get(value.id)
        return optionId ? [[optionId, value.value]] : []
      })
    ),
    price: variantPrice(variant, displays),
    kurus: kurusOf(variant.calculated_price?.calculated_amount),
    available: isAvailable(variant),
    sku: variant.sku,
  }))
  const requested = views.find((variant) => variant.id === requestedVariant)
  const selected = requested ?? views.find((variant) => variant.available) ?? views[0] ?? null
  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle,
    description: paragraphsOf(product.description),
    descriptionHtml,
    brand: product.brand && brandPath ? { label: product.brand.name, path: brandPath } : null,
    breadcrumbs: breadcrumbsOf(seo, t("home.label"), product.title),
    images: productImages(product),
    options,
    variants: views,
    selectedVariantId: selected?.id ?? null,
    specs: specsOf(product.attribute_values, t),
    trustBadges,
    withdrawalNote: withdrawalNoteOf(product, t),
  }
}

/**
 * A product's own withdrawal mark in words, said before the purchase (MSY
 * md. 5/1-h, 6/2), read by its kind as the backend's `productMarkOf` does
 * (adr/0052 Ek 2026-11-03): on a physical product a sealed hygiene good,
 * returnable while unopened (md. 15/1-ç); on a digital or service one no
 * right of withdrawal (md. 15/1-ğ, h). Null unmarked, or when the answer
 * left the mark or the kind out.
 */
export function withdrawalNoteOf(product: StoreProduct, t: Translate): string | null {
  const extension = product.product_extension
  if (extension?.withdrawal_excluded !== true) {
    return null
  }
  const kind = extension.kind
  if (kind === "physical") {
    return t("product.sealed_goods")
  }
  return kind === "digital" || kind === "service" ? t("product.withdrawal_excluded") : null
}

/** Every variant id of the products, for one price display call. */
export const variantIdsOf = (products: readonly StoreProduct[]): string[] =>
  products.flatMap((product) => (product.variants ?? []).map((variant) => variant.id))
