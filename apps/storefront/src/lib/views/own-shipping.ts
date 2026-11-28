import { formatLira } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"
import type { PriceDisplay, StoreProduct, StoreShippingClass } from "@qticaret/types"
import { paidAmount } from "./price"

/**
 * A product's own shipping as its page says it (adr/0087 §3), told as
 * checkout charges it (§2): the free class ships free; a surcharged class
 * adds its surcharge, but a basket at or past the shop's threshold ships
 * free with the surcharge gone too (§2.5), so the line names the
 * threshold beside it, and a product whose price alone reaches it ships
 * free. Pure: the screen fetches.
 */

/** The built-in class (adr/0087 §1): the product ships free. */
export const FREE_SHIPPING_CLASS = "free"

export type OwnShipping =
  | { kind: "free" }
  /** `from`: the shop's threshold in lira (KDV in); null: none. */
  | { kind: "surcharge"; amount: number; from: number | null }

export interface OwnShippingInput {
  product: StoreProduct
  /** The shop's own classes (`shipping_classes`). */
  classes: readonly StoreShippingClass[]
  /** Lira, KDV in (`free_shipping_threshold`); null or 0: no free shipping. */
  threshold: number | null
  /** The lowest KDV-included price the product is paid at (`lowestPaidOf`); null: unknown. */
  lowestPaid: number | null
}

/** Kuruş, so float noise never decides a threshold. */
const kurus = (lira: number): number => Math.round(lira * 100)

/** The product's own shipping; null for a Standard product (the threshold line says it). */
export function ownShippingOf({
  product,
  classes,
  threshold,
  lowestPaid,
}: OwnShippingInput): OwnShipping | null {
  const key = product.product_extension?.shipping_class ?? null
  if (key === FREE_SHIPPING_CLASS) {
    return { kind: "free" }
  }
  const amount = classes.find((each) => each.key === key)?.surcharge ?? 0
  if (!(amount > 0)) {
    return null
  }
  const from = threshold !== null && threshold > 0 ? threshold : null
  // Every price it is sold at reaches the threshold alone: no basket of it pays shipping
  if (from !== null && lowestPaid !== null && kurus(lowestPaid) >= kurus(from)) {
    return { kind: "free" }
  }
  return { kind: "surcharge", amount, from }
}

/** The line in words: "Bu ürünün kargosu ücretsiz.", the surcharge with the threshold when there is one. */
export function ownShippingText(own: OwnShipping, t: Translate): string {
  if (own.kind === "free") {
    return t("product.shipping_free_product")
  }
  return own.from === null
    ? t("product.shipping_surcharge", { amount: formatLira(own.amount) })
    : t("product.shipping_surcharge_until", {
        amount: formatLira(own.amount),
        from: formatLira(own.from),
      })
}

/**
 * The lowest KDV-included price among the product's variants (a
 * wholesaler's too, as the free shipping rule reads it); null when none
 * has a price the shopper can pay. The same reading as the card's badge.
 */
export function lowestPaidOf(
  product: StoreProduct,
  displays: Readonly<Record<string, PriceDisplay>>
): number | null {
  const amounts = (product.variants ?? []).flatMap((variant) => {
    const amount = paidAmount(variant, displays)
    return amount === null ? [] : [amount]
  })
  return amounts.length > 0 ? Math.min(...amounts) : null
}
