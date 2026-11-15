import type { CardShownView, ProductCardView } from "@qticaret/ui"

/**
 * Today's card (adr/0049 Ek 2026-11-15): every pill, the price on a
 * sold-out card, nothing where the stars stand without reviews. A card
 * the shop left so carries no `shown`, its view as it was.
 */
export const CARD_SHOWN_DEFAULTS: CardShownView = {
  saleBadge: true,
  lowStockBadge: true,
  soldOutBadge: true,
  soldOutRow: "price",
  noReviews: "hide",
}

const KEYS = Object.keys(CARD_SHOWN_DEFAULTS) as (keyof CardShownView)[]

/** The card's `shown` when the shop changed any of it; none for today's card. */
export function cardShown(options: CardShownView | undefined): CardShownView | undefined {
  if (!options || KEYS.every((key) => options[key] === CARD_SHOWN_DEFAULTS[key])) {
    return undefined
  }
  return { ...options }
}

/**
 * A card whose reviews the storefront does not know: empty stars or "İlk
 * yorumu sen yaz" would say it has none, so nothing stands there.
 */
export function unrated(card: ProductCardView): ProductCardView {
  if (!card.shown || card.shown.noReviews === "hide") {
    return card
  }
  const shown = cardShown({ ...card.shown, noReviews: "hide" })
  const rest = { ...card }
  delete rest.shown
  return shown ? { ...rest, shown } : rest
}
