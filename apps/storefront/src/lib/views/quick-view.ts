import type { CardRatingView, QuickViewView, Translate } from "@qticaret/ui"
import type { PriceDisplay, StoreProduct } from "@qticaret/types"
import { productPage } from "./product"
import { paragraphsOf } from "./text"

/** The storefront's quick view address (the layout's `quickView.address`): `GET ?id=`. */
export const QUICK_VIEW_PATH = "/api/quick-view"

/**
 * The address the dialog asks: in the theme editor's preview (its signed
 * token, set by the proxy) the preview's own `/hizli-bakis`, so the answer
 * reads the draft's settings the frame is showing, never the live ones; else
 * `QUICK_VIEW_PATH`.
 */
export const quickViewAddress = (previewToken: string | null): string =>
  previewToken ? `/onizleme/${previewToken}/hizli-bakis` : QUICK_VIEW_PATH

// Medusa's product ids: `prod_` and a ULID; anything else is refused before the backend
const PRODUCT_ID = /^prod_[0-9A-Za-z]{1,64}$/

/** The asked product's id from `?id=`, or null for anything not a product id. */
export function quickViewIdOf(params: URLSearchParams): string | null {
  const id = params.get("id")
  return id !== null && PRODUCT_ID.test(id) ? id : null
}

/** What the shop shows in the dialog (`product_card.quick_view_*`). */
export interface QuickViewShown {
  /** The brand, as the shop shows it on its cards (`product_card.show_brand`). */
  brand: boolean
  rating: boolean
  summary: boolean
  quantity: boolean
}

interface QuickViewInput {
  product: StoreProduct
  path: string
  displays: Record<string, PriceDisplay>
  /** The backend's HTML of the short description (adr/0055); null: none. */
  summaryHtml: string | null
  /** The stars in short (`cardRating`); null: no review. */
  rating: CardRatingView | null
  shown: QuickViewShown
  /** The product asks for more than the dialog's fields (see `QuickViewView.needsPage`). */
  needsPage: boolean
  t: Translate
  /** The shop's colour names: matching option values show as swatches. */
  swatchOf?: (value: string) => string | null
}

/**
 * A card's quick view (adr/0049 Ek 2026-11-15): the product page's own
 * view of the product (`productPage`: its photos, options, variants priced
 * by the 30-day rule, the first one in stock chosen), cut to what the
 * dialog shows; the stars and the short description only as the shop
 * shows them, the description's first paragraph standing in for a
 * missing short one. No instalments, specs or reviews: its page has them.
 */
export function quickViewOf({
  product,
  path,
  displays,
  summaryHtml,
  rating,
  shown,
  needsPage,
  t,
  swatchOf,
}: QuickViewInput): QuickViewView {
  const page = productPage({
    product,
    seo: null,
    displays,
    brandPath: null,
    requestedVariant: null,
    t,
    trustBadges: [],
    ...(swatchOf ? { swatchOf } : {}),
  })
  const summaryText =
    shown.summary && !summaryHtml ? (paragraphsOf(product.description)[0] ?? null) : null
  return {
    id: product.id,
    title: product.title,
    path,
    brand: shown.brand ? (product.brand?.name ?? null) : null,
    images: page.images,
    options: page.options,
    // The dialog has no instalment line: none carried
    variants: page.variants.map((variant) => {
      const shown = { ...variant }
      delete shown.installments
      return shown
    }),
    selectedVariantId: page.selectedVariantId,
    rating: shown.rating ? rating : null,
    summaryHtml: shown.summary ? summaryHtml : null,
    summaryText,
    quantity: shown.quantity,
    needsPage,
  }
}
