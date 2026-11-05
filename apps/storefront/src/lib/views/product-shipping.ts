import { formatLira } from "@qticaret/ui"
import type {
  LinkView,
  ProductShippingView,
  ShopMarkView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"

/**
 * The product page's "Kargo ve Teslimat" card (owner 2026-11-05: "bu ürün
 * özelliklerinin yanında genel bir kargo bilgilendirmesi alanı
 * ekleyelim"), from what the shop set and wrote, never a promise of our
 * own: the free shipping threshold (settings), the shop's promises it
 * marked with the shipping, clock or returns icon (the panel names them
 * "Kargo", "Saat", "İade ve değişim"), the return window, the carriers it
 * connected and the pages that say more. Pure: the screen fetches.
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

/** A product the shop ships: physical (the backend's default kind) and not a gift card. */
export const isShipped = (product: StoreProduct): boolean => {
  const extension = product.product_extension
  return (extension?.kind ?? "physical") === "physical" && extension?.is_gift_card !== true
}

export interface ProductShippingInput {
  product: StoreProduct
  /** Lira, KDV in (`free_shipping_threshold`); null or 0: no free shipping. */
  threshold: number | null
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
  threshold,
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
  const free: TrustBadgeView[] = named
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
  const delivery = promises.filter((badge) => badge !== named && badge.icon !== "refresh")
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
    facts: [...free, ...delivery, ...withdrawal],
    carriers,
    links: [
      ...(shippingPath ? [{ label: t("product.shipping_more"), path: shippingPath }] : []),
      ...(returnPolicy ? [returnPolicy] : []),
    ],
  }
}
