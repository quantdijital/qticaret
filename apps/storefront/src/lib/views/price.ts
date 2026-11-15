import { formatLira } from "@qticaret/ui"
import type { PriceView, Translate } from "@qticaret/ui"
import type { PriceDisplay, StoreCartOffer, StoreVariant } from "@qticaret/types"
import { t as words } from "../i18n"
import { isWholesaleDisplays } from "./wholesale-displays"

/** Whether a variant can be put in the cart now (stock, or no stock kept, or backorders). */
export const isAvailable = (variant: StoreVariant): boolean =>
  variant.manage_inventory === false ||
  variant.allow_backorder === true ||
  (variant.inventory_quantity ?? 0) > 0

/** Whole percent off, rounded down so the badge never promises more than the price gives. */
export function percentOff(before: number, amount: number): number | null {
  // A display's lira string that is no number gives no badge
  if (!Number.isFinite(before) || !(before > amount) || before <= 0) {
    return null
  }
  // Floating point leaves an exact cut a hair short (3.749,00 → 2.624,30 TL is 29.999…%):
  // only that noise is forgiven, a real 29.99% still says 29
  const percent = Math.floor(((before - amount) / before) * 100 + 1e-9)
  return percent >= 1 ? percent : null
}

/**
 * What a shopper pays for a variant now: the backend's display, an
 * automatic promotion every shopper gets included (adr/0023 Ek
 * 2026-11-05), else Medusa's calculated price. Both come from the server.
 * A wholesaler's variant without a display of their own has no price
 * (ADR-0068 §7, review L2): Medusa's group price would carry KDV unsaid.
 */
export function shownAmount(
  variant: StoreVariant,
  displays: Readonly<Record<string, PriceDisplay>>
): number | null {
  const shown = Number(displays[variant.id]?.current)
  if (displays[variant.id] && Number.isFinite(shown)) {
    return shown
  }
  if (isWholesaleDisplays(displays)) {
    return null
  }
  const amount = variant.calculated_price?.calculated_amount
  return typeof amount === "number" ? amount : null
}

/**
 * Whether a variant's price is a signed-in wholesaler's own, without KDV
 * (ADR-0068 §7), or one of theirs left unpriced: the shop-wide extras of
 * a retail price (installments, Open Graph, a bare "from") leave it out.
 */
export const isVatExclusive = (
  variant: Pick<StoreVariant, "id">,
  displays: Readonly<Record<string, PriceDisplay>>
): boolean => displays[variant.id]?.vat_exclusive === true || isWholesaleDisplays(displays)

/**
 * What the shopper pays for a variant, KDV included: the shown amount,
 * or a wholesaler's KDV-included one (their shown price is without it).
 * For what follows the money paid: installments, free shipping, events.
 */
export function paidAmount(
  variant: StoreVariant,
  displays: Readonly<Record<string, PriceDisplay>>
): number | null {
  const display = displays[variant.id]
  const gross = Number(display?.gross)
  if (display?.vat_exclusive === true && display.gross !== undefined && Number.isFinite(gross)) {
    return gross
  }
  return shownAmount(variant, displays)
}

/** A cart offer in words: "Sepette %10 indirim", "2.000,00 TL ve üzeri sepette %10 indirim". */
export function cartOfferText(
  offer: StoreCartOffer | null | undefined,
  t: Translate
): string | null {
  if (!offer) {
    return null
  }
  const minimum = offer.minimum === null ? null : Number(offer.minimum)
  const amount = Number(offer.value)
  if (!Number.isFinite(amount) || amount <= 0 || (minimum !== null && !Number.isFinite(minimum))) {
    return null
  }
  const values =
    offer.type === "percentage"
      ? { percent: String(amount).replace(".", ",") }
      : { amount: formatLira(amount) }
  const kind = offer.type === "percentage" ? "percent" : "amount"
  return minimum !== null && minimum > 0
    ? t(`price.cart_offer_${kind}_min`, { ...values, minimum: formatLira(minimum) })
    : t(`price.cart_offer_${kind}`, values)
}

/** One variant's price: what the shopper pays now, struck through only per the price-before rule. */
export function variantPrice(
  variant: StoreVariant,
  displays: Readonly<Record<string, PriceDisplay>>,
  t?: Translate
): PriceView | null {
  const amount = shownAmount(variant, displays)
  if (amount === null) {
    return null
  }
  const display = displays[variant.id]
  const before = display?.before ?? null
  const discount = before ? percentOff(Number(before), amount) : null
  const cartOffer = t ? cartOfferText(display?.cart_offer, t) : null
  return {
    current: formatLira(amount),
    before: before ? formatLira(before) : null,
    from: false,
    discount,
    saving: before && discount !== null ? formatLira(Number(before) - amount) : null,
    ...(cartOffer ? { cartOffer } : {}),
    // A wholesaler's one price, without KDV (ADR-0068 §6–§7); never on anyone else's
    ...(display?.vat_exclusive === true ? { taxNote: words("price.wholesale_note") } : {}),
  }
}

/**
 * A product's price on a card: its lowest, "from" when its variants
 * differ, struck through when that lowest variant's display allows it.
 */
export function cardPrice(
  variants: readonly StoreVariant[],
  displays: Readonly<Record<string, PriceDisplay>>
): PriceView | null {
  const priced = variants.flatMap((variant) => {
    const amount = shownAmount(variant, displays)
    return amount === null ? [] : [{ variant, amount }]
  })
  const lowest = priced.reduce<(typeof priced)[number] | null>(
    (best, each) => (best === null || each.amount < best.amount ? each : best),
    null
  )
  if (!lowest) {
    return null
  }
  const amounts = new Set(priced.map((each) => each.amount))
  const price = variantPrice(lowest.variant, displays)
  return price ? { ...price, from: amounts.size > 1 } : null
}
