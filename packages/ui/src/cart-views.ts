import type { AddonFormView, LineAddonView } from "./addon-views"
import type { BreadcrumbView, ProductCardView } from "./product-views"
import type { ImageView, LinkView, TrustBadgeView } from "./views"

/**
 * The cart and what follows it as a theme shows them (adr/0046 §7):
 * its lines, gift cards, free shipping and installments, the confirm page.
 */

export interface CartLineView {
  id: string
  title: string
  detail: string | null
  quantity: number
  /** The line's total, KDV included; without it when `taxNote` says so. */
  total: string
  /** The line before its discount, only when one applies. */
  original: string | null
  /** A wholesaler's line (ADR-0068 §5): "KDV hariç" under a total without KDV; absent otherwise. */
  taxNote?: string | null
  image: ImageView | null
  /**
   * The product's page with the line's variant chosen (`?variant=`), for
   * its photo and name; null or absent: the shop no longer shows the
   * product, and the line reads as text.
   */
  path?: string | null
  /** A gift card line's recipient (adr/0025 Ek 2026-11-03); absent on any other line. */
  gift?: GiftLineView | null
  /** The line's add-on picks (adr/0052), one under another; none on a plain line. */
  addons: LineAddonView[]
  /** A pick made to the buyer's wish puts the line outside the right of withdrawal. */
  nonWithdrawable: boolean
  /** The most units the line may hold with its picks; null or absent: the cart's own limit. */
  maxQuantity?: number | null
  /** The picks' form, for a line of a product with add-ons while the shop offers them. */
  addonForm?: AddonFormView | null
}

/** A gift card line: who it goes to, as typed (the edit form shows it again). */
export interface GiftLineView {
  /** Null: not named yet; the payment waits for it. */
  recipient: GiftRecipientView | null
}

export interface GiftRecipientView {
  email: string
  name: string | null
  message: string | null
  sender: string | null
}

export interface CartPageView {
  lines: CartLineView[]
  /** Items before discounts; the discount only when there is one. */
  items: string
  discount: string | null
  subtotal: string
  /**
   * A wholesaler's cart (ADR-0068 §5), Medusa's totals in words: the
   * items without KDV (shown in place of `items`, the discount then
   * without KDV too) and the KDV on them as a line of its own; the
   * subtotal still includes it. Absent for every other shopper.
   */
  tax?: TaxLinesView | null
  /** The coupon codes on the cart, each removable. */
  promotions: string[]
  /** The gift card codes on the cart, each removable; null while the shop sells none (F4.8). */
  giftCards?: string[] | null
  /** What the gift cards take off, in words; null when none. */
  credit?: string | null
  /** Said while a gift card line meets a gift card or credit on the cart, in words (a card buys no card). */
  giftNotice?: string | null
  /** How near the cart is to free shipping; null when the shop gives none. */
  freeShipping: FreeShippingView | null
  /** A message for the shopper after a failed change, already in words. */
  error: string | null
  /**
   * A payment link's cart (adr/0051), in words: its lines, quantities and
   * discount are fixed, so no quantity, remove, code or add-on controls.
   */
  locked?: string | null
  /**
   * Shipping before an address, in words (adr/0046 Ek 2026-11-05): the
   * cheapest option the backend offers this cart now ("Ücretsiz",
   * "85,00 TL"); null or left out: "at checkout".
   */
  shipping?: string | null
  /**
   * The shop's automatic offers the cart reaches by its total, in words
   * ("2.000,00 TL ve üzeri sepette %10 indirim"), each once; none: no line.
   */
  offers?: string[]
  /** The shop's promises (its trust badges), beside the totals; none: no strip. */
  trust?: TrustBadgeView[]
  /** Products to add, never one already in the cart: the shop's best sellers or newest. */
  upsell?: { title: string; products: ProductCardView[] } | null
  /**
   * Why the cart cannot go to the payment yet, in words (a wholesaler's
   * order under its minimum units, ADR-0068 §8): "Ödemeye geç" is drawn
   * off with the reason beside it. Null or left out: the button as ever.
   * A hint only; the backend refuses the payment itself.
   */
  checkoutBlocked?: CheckoutBlockedView | null
}

/** A reason the cart stops before the payment (`CartPageView.checkoutBlocked`). */
export interface CheckoutBlockedView {
  /** "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var." */
  reason: string
}

/** The KDV shown on its own line (ADR-0068 §5): never added up here, Medusa's amounts in words. */
export interface TaxLinesView {
  /** The items before discounts, without KDV ("1.000,00 TL"). */
  items: string
  /** The KDV on the items. */
  vat: string
  /** Said under the totals in place of "Fiyatlara KDV dahildir.". */
  note: string
}

export interface FreeShippingView {
  /** "Ücretsiz kargo için 250,00 TL daha ekleyin" or "Kargo ücretsiz", in words. */
  message: string
  /** 0–100, the bar's fill. */
  percent: number
  reached: boolean
}

/** A page that asks before it acts (a link from an e-mail): the words, the form's hidden fields. */
export interface ConfirmPageView {
  title: string
  text: string
  /** A warning above the button, when acting replaces something. */
  warning: string | null
  fields: { name: string; value: string }[]
  /** The button's words; null when there is nothing left to do (done, or a broken link). */
  submit: string | null
  back: LinkView
}

/** A card family's installment plans (F5): "3 × 428,78 TL", the total, in words. */
export interface InstallmentFamilyView {
  /** As the family is written on its own cards ("Bonus", "World"). */
  family: string
  options: {
    count: number
    perInstallment: string
    total: string
    /** Two or more installments at the price of one payment (no surcharge): "Peşin fiyatına". */
    free?: boolean
  }[]
}

/**
 * A price's installments in one line (owner 2026-11-05): the most any
 * card family offers and the lowest monthly amount at that count,
 * worked out on the storefront's server from the same table the dialog
 * shows: "12 aya varan taksit · aylık 203,04 TL'den".
 */
export interface InstallmentSummaryView {
  count: number
  /** "203,04 TL". */
  perInstallment: string
}

/** `/hediye-karti/bakiye`: a gift card's balance, asked by its code (adr/0025 Ek 2026-11-03). */
export interface GiftCardBalancePageView {
  title: string
  text: string
  breadcrumbs: BreadcrumbView[]
}
