import { formatLira } from "@qticaret/ui"
import type {
  LinkView,
  ProductShippingView,
  ShopMarkView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import type { StoreDelivery, StoreProduct, StoreShippingClass } from "@qticaret/types"
import { ownShippingOf, ownShippingText } from "./own-shipping"

export { FREE_SHIPPING_CLASS } from "./own-shipping"

/**
 * The product page's "Kargo ve Teslimat" card (owner 2026-11-05: "bu ürün
 * özelliklerinin yanında genel bir kargo bilgilendirmesi alanı
 * ekleyelim"), from what the shop set and wrote, never a promise of our
 * own: the free shipping threshold (settings), when an order leaves and
 * arrives and the same-day hour (settings, adr/0046 Ek 2026-11-06), else
 * the shop's promises it marked with the shipping or clock icon (the
 * panel names them "Kargo", "Saat"), the return window (its "İade ve
 * değişim" promise), the carriers it connected and the pages that say
 * more. Pure: the screen fetches.
 */

/** The promise icons that speak of delivery and returns: those promises stand in the card. */
const SHIPPING_ICONS: ReadonlySet<TrustBadgeView["icon"]> = new Set(["truck", "clock", "refresh"])

/**
 * The right of withdrawal the law gives (MSY md. 9): 14 days from
 * delivery. The shop's own `returns.withdrawal_days` is never below it;
 * the Store API does not carry the shop's number yet, so the card says the
 * floor every shop keeps.
 */
export const WITHDRAWAL_DAYS = 14

/** The amounts a line names as Turkish writes them ("₺1.500", "1.500,00 TL", "750"). */
const amountsIn = (text: string): number[] =>
  [...text.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g)].map(([match]) =>
    Number(match.replace(/\./g, "").replace(",", "."))
  )

/** Working days as Turkish writes a span: "2", "1–2". The shorter at 0 or the same: the longer alone. */
const span = (min: number, max: number): string =>
  min <= 0 || min === max ? String(max) : `${String(min)}–${String(max)}`

/** The dative ending of an hour read aloud, by its last word: on 'a, bir 'e, iki 'ye, üç 'e… */
const DATIVE = ["a", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"] as const

/** "15.00'e", "16.00'ya", "20.00'ye" (yirmi, not on): the hour as Turkish prints it, a full stop (Tezgâh audit K-29). */
const untilHour = (hour: number): string =>
  `${String(hour).padStart(2, "0")}.00'${hour === 20 ? "ye" : (DATIVE[hour % 10] ?? "e")}`

/**
 * The delivery facts from the shop's settings: when an order leaves (the
 * same days the product's `shippingDetails` and `kargo_cümlesi` say), the
 * whole wait to the door, and the same-day hour when it promises one. A
 * plain line: no countdown, no weekend rule (the shop's page says those).
 */
export function deliveryFacts(delivery: StoreDelivery, t: Translate): TrustBadgeView[] {
  const { handling_days: handling, transit_days: transit } = delivery
  const total = { min: handling.min + transit.min, max: handling.max + transit.max }
  const leaves: TrustBadgeView = {
    icon: "truck",
    title:
      handling.max <= 0
        ? t("product.shipping_dispatch_today")
        : t("product.shipping_dispatch", { days: span(handling.min, handling.max) }),
    text:
      total.max > 0 ? t("product.shipping_arrival", { days: span(total.min, total.max) }) : null,
  }
  const hour = delivery.same_day_cutoff_hour
  return hour === null
    ? [leaves]
    : [
        leaves,
        {
          icon: "clock",
          title: t("product.shipping_cutoff", { time: untilHour(hour) }),
          text: null,
        },
      ]
}

/** A product the shop ships: physical (the backend's default kind) and not a gift card. */
export const isShipped = (product: StoreProduct): boolean => {
  const extension = product.product_extension
  return (extension?.kind ?? "physical") === "physical" && extension?.is_gift_card !== true
}

/** The promise icons that speak of a parcel's delivery (shipping, the same-day hour); returns are not one. */
const DELIVERY_ICONS: ReadonlySet<TrustBadgeView["icon"]> = new Set(["truck", "clock"])

/**
 * The shop's promises as a product's page says them: all of them on a
 * product the shop ships; on one it does not (a dated tour, a service, a
 * download, a gift card) none of delivery, no shipping promise where
 * nothing is shipped. Returns and cancellation stay (a free cancellation
 * is a promise there too).
 */
export const promisesFor = (
  product: StoreProduct,
  badges: readonly TrustBadgeView[]
): TrustBadgeView[] => shippedPromises(isShipped(product), badges)

/** The same rule for a whole cart: with nothing in it to ship (only tours, services), no delivery promise. */
export const shippedPromises = (
  ships: boolean,
  badges: readonly TrustBadgeView[]
): TrustBadgeView[] =>
  ships ? [...badges] : badges.filter((badge) => !DELIVERY_ICONS.has(badge.icon))

/**
 * The short note beside "Sepete ekle" (adr/0087 §3), the card's own line
 * in one sentence: the product's free or surcharged shipping, else the
 * shop's threshold; null for a product not shipped or a shop without one.
 */
export function shippingNoteOf({
  product,
  classes = [],
  threshold,
  lowestPaid = null,
  t,
}: Pick<ProductShippingInput, "product" | "classes" | "threshold" | "lowestPaid" | "t">):
  string | null {
  if (!isShipped(product)) {
    return null
  }
  const own = ownShippingOf({ product, classes, threshold, lowestPaid })
  if (own) {
    return ownShippingText(own, t)
  }
  return threshold !== null && threshold > 0
    ? t("product.free_shipping_from", { amount: formatLira(threshold) })
    : null
}

export interface ProductShippingInput {
  product: StoreProduct
  /** The shop's own classes (`shipping_classes`); a product's surcharge is said by them. */
  classes?: readonly StoreShippingClass[]
  /** Lira, KDV in (`free_shipping_threshold`); null or 0: no free shipping. */
  threshold: number | null
  /** The product's lowest KDV-included price (`lowestPaidOf`): at the threshold alone it ships free. */
  lowestPaid?: number | null
  /** The shop's delivery settings (`delivery`); absent from an older backend: its own lines say it. */
  delivery?: StoreDelivery | null
  /** The shop's promises (its trust badges), in its order. */
  badges: readonly TrustBadgeView[]
  carriers: ShopMarkView[]
  /** The shop's shipping page (`shipping_info_path`); null: none chosen. */
  shippingPath: string | null
  /** The published return policy's page and title; null while unpublished. */
  returnPolicy: LinkView | null
  t: Translate
}

/** The card for a shipped product; null for one that is not shipped. */
export function productShipping({
  product,
  classes = [],
  threshold,
  lowestPaid = null,
  delivery = null,
  badges,
  carriers,
  shippingPath,
  returnPolicy,
  t,
}: ProductShippingInput): ProductShippingView | null {
  if (!isShipped(product)) {
    return null
  }
  const from = threshold !== null && threshold > 0 ? threshold : null
  const promises = badges.filter((badge) => SHIPPING_ICONS.has(badge.icon))
  // The shop's own line that names the threshold is the free shipping fact, in its words
  const named = promises.find(
    (badge) =>
      badge.icon === "truck" &&
      from !== null &&
      amountsIn(`${badge.title} ${badge.text ?? ""}`).includes(from)
  )
  // adr/0087 §3: this product's own shipping first; a surcharge is said, never a surprise,
  // and with the threshold beside it, since a basket past it pays none (§2.5)
  const mine = ownShippingOf({ product, classes, threshold, lowestPaid })
  const own: TrustBadgeView[] =
    mine === null
      ? []
      : [
          {
            icon: "truck",
            title: t(
              mine.kind === "free" ? "product.shipping_free" : "product.shipping_surcharge_title"
            ),
            text: ownShippingText(mine, t),
          },
        ]
  // The threshold line only for a Standard product: the own line says it otherwise
  const free: TrustBadgeView[] =
    mine !== null
      ? []
      : named
        ? [named]
        : from !== null
          ? [
              {
                icon: "truck",
                title: t("product.shipping_free"),
                text: t("product.shipping_free_from", { amount: formatLira(from) }),
              },
            ]
          : []
  // The settings say when it leaves; without them, the shop's own shipping and clock lines
  const leaves = delivery
    ? deliveryFacts(delivery, t)
    : promises.filter((badge) => badge !== named && badge.icon !== "refresh")
  const returns = promises.filter((badge) => badge.icon === "refresh")
  const sealed = product.product_extension?.withdrawal_excluded === true
  const withdrawal: TrustBadgeView[] =
    returns.length > 0
      ? returns
      : [
          {
            icon: "refresh",
            title: t("product.shipping_returns", { days: WITHDRAWAL_DAYS }),
            text: t(sealed ? "product.shipping_returns_sealed" : "product.shipping_returns_free"),
          },
        ]
  return {
    facts: [...own, ...free, ...leaves, ...withdrawal],
    carriers,
    links: [
      ...(shippingPath ? [{ label: t("product.shipping_more"), path: shippingPath }] : []),
      ...(returnPolicy ? [returnPolicy] : []),
    ],
  }
}
