import type { CardVariant, FramedCardView } from "@qticaret/ui"
import type { PriceDisplay, StoreLayoutSection, StoreProduct } from "@qticaret/types"
import { CARD_VARIANTS } from "@qticaret/types/section-variants"
import { productImages } from "./image"
import { shownAmount } from "./price"
import { isShipped } from "./product-shipping"

/**
 * The framed card's switches (adr/0049 Ek 2026-11-14 §3.3, E5), the theme
 * setting's wherever a framed card is drawn: a rail picks the variant only.
 */
export interface FramedCardOptions {
  hoverImage: boolean
  deliveryNote: boolean
  fullButton: boolean
  emptyStars: boolean
  /** Lira, KDV in (`free_shipping_threshold`); null or 0: no free shipping. */
  freeShippingFrom: number | null
}

/**
 * Whether every price the card stands for reaches the free shipping
 * threshold: its lowest shown price (the backend's, never worked out
 * here) at or over it, for a product the shop ships.
 */
function shipsFree(
  product: StoreProduct,
  displays: Readonly<Record<string, PriceDisplay>>,
  from: number | null
): boolean {
  if (from === null || !(from > 0) || !isShipped(product)) {
    return false
  }
  const amounts = (product.variants ?? []).flatMap((variant) => {
    const amount = shownAmount(variant, displays)
    return amount === null ? [] : [amount]
  })
  return amounts.length > 0 && Math.min(...amounts) >= from
}

/** What a framed card shows beyond today's card; none for another variant. */
export function framedCard(
  variant: CardVariant,
  product: StoreProduct,
  displays: Readonly<Record<string, PriceDisplay>>,
  options: FramedCardOptions
): FramedCardView | undefined {
  if (variant !== "framed") {
    return undefined
  }
  return {
    secondImage: options.hoverImage ? (productImages(product)[1] ?? null) : null,
    freeShipping: options.deliveryNote && shipsFree(product, displays, options.freeShippingFrom),
    fullButton: options.fullButton,
    emptyStars: options.emptyStars,
  }
}

/**
 * A product rail's own card variant (`card_variant`, owner's decision 4);
 * null: the theme setting's. One this build does not know (a newer
 * backend's) is the setting's too.
 */
export function railCardVariant(
  section: Pick<Extract<StoreLayoutSection, { type: "products" }>, "card_variant">
): CardVariant | null {
  return CARD_VARIANTS.find((each) => each === section.card_variant) ?? null
}
