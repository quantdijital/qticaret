import type { CardVariant, FramedCardView } from "@qticaret/ui"
import type { CardButtonStyle } from "@qticaret/types"
import type { PriceDisplay, StoreLayoutSection, StoreProduct } from "@qticaret/types"
import { CARD_VARIANTS } from "@qticaret/types/section-variants"
import { paidAmount } from "./price"
import { FREE_SHIPPING_CLASS, isShipped } from "./product-shipping"

/**
 * The framed card's switches (adr/0049 Ek 2026-11-14 §3.3, E5), the theme
 * setting's wherever a framed card is drawn: a rail picks the variant only.
 */
export interface FramedCardOptions {
  deliveryNote: boolean
  fullButton: boolean
  /** The foot button's look (adr/0049 Ek 2026-11-15). */
  buttonStyle: CardButtonStyle
  /** Lira, KDV in (`free_shipping_threshold`); null or 0: no free shipping. */
  freeShippingFrom: number | null
}

/**
 * Whether the product ships free: in the free shipping class (adr/0087 §3,
 * whatever its price), or every price the card stands for reaches the
 * threshold: its lowest shown price (the backend's, never worked out
 * here) at or over it, for a product the shop ships.
 */
function shipsFree(
  product: StoreProduct,
  displays: Readonly<Record<string, PriceDisplay>>,
  from: number | null
): boolean {
  if (!isShipped(product)) {
    return false
  }
  if (product.product_extension?.shipping_class === FREE_SHIPPING_CLASS) {
    return true
  }
  if (from === null || !(from > 0)) {
    return false
  }
  const amounts = (product.variants ?? []).flatMap((variant) => {
    // The KDV-included amount, as the free shipping rule reads it (a wholesaler's too)
    const amount = paidAmount(variant, displays)
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
    freeShipping: options.deliveryNote && shipsFree(product, displays, options.freeShippingFrom),
    fullButton: options.fullButton,
    buttonStyle: options.buttonStyle,
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
