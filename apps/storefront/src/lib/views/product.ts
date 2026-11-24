import type {
  BreadcrumbView,
  CardLookView,
  CardShownView,
  CardVariant,
  InstallmentSummaryView,
  ProductCardView,
  ProductPageView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import type { CardQuickViewTrigger, PriceDisplay, SeoPayload, StoreProduct } from "@qticaret/types"
import { framedCard, type FramedCardOptions } from "./card-framed"
import { cardLook } from "./card-look"
import { cardShown } from "./card-shown"
import { productImages, variantImages } from "./image"
import { cardPrice, isAvailable, isVatExclusive, shownAmount, variantPrice } from "./price"
import { isShipped } from "./product-shipping"
import { productVideos } from "./product-videos"
import { specGroupsOf, specsOf } from "./specs"
import { paragraphsOf, pathOf } from "./text"

/** A price in kuruş, for the add-ons' running total only (adr/0052); null without one. */
const kurusOf = (amount: number | null | undefined): number | null =>
  typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) : null

/** What the shop shows on its cards (adr/0053 §B, `product_card`). */
export interface CardOptions {
  showBrand: boolean
  /** The stars of its approved reviews, from the card facts (`withCardFacts`, adr/0062). */
  showRating: boolean
  /** How the cards are drawn (adr/0049 Ek 2026-11-14 §3.3); none: `standard`. */
  variant?: CardVariant
  /** The second photo on hover, every variant's (`hover_image`, sahip 2026-11-18); none: off. */
  hoverImage?: boolean
  /** A framed card's own, from the theme setting; none: a framed card shows only today's. */
  framed?: FramedCardOptions
  /** Every card's pills and rows (adr/0049 Ek 2026-11-15); none: today's card. */
  shown?: CardShownView
  /** The quick view button's look while the shop has it on (adr/0049 Ek 2026-11-15); none: no button. */
  quickView?: CardQuickViewTrigger | null
  /** The tour card's look (adr/0077 Ek "tur kartı"); none: today's card. */
  look?: CardLookView
}

// Without the shop's settings: the brand as ever, no stars (the setting's own default)
const ALL_SHOWN: CardOptions = { showBrand: true, showRating: false }

const NO_FRAMED_EXTRAS: FramedCardOptions = {
  deliveryNote: false,
  fullButton: false,
  buttonStyle: "outline",
  freeShippingFrom: null,
}

/** A product in a grid; one without a live path is left out by the caller. */
export function productCard(
  product: StoreProduct,
  path: string,
  displays: Record<string, PriceDisplay>,
  options: CardOptions = ALL_SHOWN
): ProductCardView {
  const variants = product.variants ?? []
  const variant = options.variant ?? "standard"
  const framed = framedCard(variant, product, displays, options.framed ?? NO_FRAMED_EXTRAS)
  const shown = cardShown(options.shown)
  const look = cardLook(options.look)
  const images = productImages(product)
  // The second photo only beside a first one (one photo: no swap)
  const second = options.hoverImage && images[0] ? (images[1] ?? null) : null
  return {
    id: product.id,
    title: product.title,
    path,
    brand: options.showBrand ? (product.brand?.name ?? null) : null,
    image: images[0] ?? null,
    ...(second ? { secondImage: second } : {}),
    price: cardPrice(variants, displays),
    available: variants.some(isAvailable),
    // Left out for today's card: its view is as it was; the compact card carries no extras
    ...(framed ? { variant, framed } : variant === "compact" ? { variant } : {}),
    ...(shown ? { shown } : {}),
    ...(options.quickView ? { quickView: options.quickView } : {}),
    ...(look ? { look } : {}),
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
  /** The backend's HTML of its short description (adr/0055 Ek 2026-11-06); null or left out: none. */
  summaryHtml?: string | null
  /** Each variant's installments in one line, by its id (`installmentSummaries`); none: no line. */
  installments?: Readonly<Record<string, InstallmentSummaryView>>
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
  summaryHtml = null,
  installments = {},
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
  const pictures = variantImages(product)
  const views = variants.map((variant) => ({
    id: variant.id,
    title: variant.title ?? product.title,
    options: Object.fromEntries(
      (variant.options ?? []).flatMap((value) => {
        const optionId = value.option_id ?? optionOfValue.get(value.id)
        return optionId ? [[optionId, value.value]] : []
      })
    ),
    price: variantPrice(variant, displays, t),
    // The add-ons are priced with KDV: no running total beside a wholesaler's price without it
    kurus: isVatExclusive(variant, displays) ? null : kurusOf(shownAmount(variant, displays)),
    available: isAvailable(variant),
    sku: variant.sku,
    installments: installments[variant.id] ?? null,
    ...(pictures.has(variant.id) ? { images: pictures.get(variant.id) ?? [] } : {}),
  }))
  const requested = views.find((variant) => variant.id === requestedVariant)
  const selected = requested ?? views.find((variant) => variant.available) ?? views[0] ?? null
  const videos = productVideos(product)
  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle,
    description: paragraphsOf(product.description),
    descriptionHtml,
    // Left out without one: the theme shows the headline facts there instead
    ...(summaryHtml ? { summaryHtml } : {}),
    brand: product.brand && brandPath ? { label: product.brand.name, path: brandPath } : null,
    breadcrumbs: breadcrumbsOf(seo, t("home.label"), product.title),
    images: productImages(product),
    // Left out without one: a product without videos is drawn as before (adr/0069 §7)
    ...(videos.length > 0 ? { videos } : {}),
    options,
    variants: views,
    selectedVariantId: selected?.id ?? null,
    // The gallery opens on the asked variant's own pictures (owner 2026-11-05)
    galleryVariantId: requested && pictures.has(requested.id) ? requested.id : null,
    specs: specsOf(product.attribute_values, t),
    specGroups: specGroupsOf(product.attribute_values, t),
    trustBadges,
    withdrawalNote: withdrawalNoteOf(product, t),
    // Not shipped: the page's own headings are neutral ones (a physical product's view as before)
    ...(isShipped(product) ? {} : { unshipped: true }),
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
