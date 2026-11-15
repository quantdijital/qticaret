import type { CardRatingView, ProductOptionView, VariantView } from "./product-views"
import type { FormAction } from "./theme"
import type { ImageView } from "./views"

/**
 * A product in a card's quick view dialog (adr/0049 Ek 2026-11-15): what
 * the storefront answers at the theme's `quickView.address` once the
 * dialog opens, never in the page's first HTML. Every amount is the
 * storefront's words (CLAUDE.md rule 5); the theme only lays it out.
 */
export interface QuickViewView {
  id: string
  title: string
  /** The product's page: "Ürün sayfasına git", and the way on from any refusal. */
  path: string
  brand: string | null
  /** The gallery's pictures, the first large; none: the empty well. */
  images: ImageView[]
  options: ProductOptionView[]
  /** Each with its price in words and its own pictures (`images`, indexes into the gallery). */
  variants: VariantView[]
  /** The variant the dialog opens on: the first one in stock, else the first. */
  selectedVariantId: string | null
  /** The stars in short; null without a review or while the shop hides them in the dialog. */
  rating: CardRatingView | null
  /** The short description's HTML (adr/0055, the backend's allow-list); null: none or hidden. */
  summaryHtml: string | null
  /** Without a short description, the description's first paragraph as plain text; null: none. */
  summaryText: string | null
  /** Whether the dialog offers a quantity field; off, it adds one. */
  quantity: boolean
  /**
   * The product asks for more than a variant and a quantity (a gift card's
   * recipient, a required add-on): the dialog offers its page, not the button.
   */
  needsPage: boolean
}

/** The layout's quick view (adr/0049 Ek 2026-11-15): given only while the shop has it on. */
export interface QuickViewSetup {
  /**
   * The storefront's own address (adr/0046 §5): `GET {address}?id=<product id>`
   * answers a `QuickViewView`, 404 for a product it does not sell.
   */
  address: string
  /** The dialog's form: `addToCart`'s fields (`variant_id`, `quantity`). */
  addToCart: FormAction
}
