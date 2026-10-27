import { fromMedusaAmount, kurus, multiplyByRateBps, sumKurus } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import type { CashOnDeliverySettings } from "../../modules/platform-settings/sections"

/** Marks the cart line that carries the fee (adr/0029): set on the server only. */
export const COD_FEE = "cash_on_delivery"

export type CodRefusal =
  | "cash_on_delivery.disabled"
  | "cash_on_delivery.over_limit"
  | "cash_on_delivery.shipping_unsupported"

/** What the fee rules read of a cart: its total, its lines, its shipping options. */
export const FEE_CART_FIELDS = [
  "total",
  "raw_total",
  "items.id",
  "items.metadata",
  "items.variant_id",
  "items.is_custom_price",
  "items.total",
  "items.raw_total",
  "shipping_methods.shipping_option_id",
]

export interface FeeLineRow {
  id: string
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  is_custom_price?: boolean | null
  raw_total?: MedusaAmount
  total?: MedusaAmount
}

export interface FeeCart {
  raw_total?: MedusaAmount
  total?: MedusaAmount
  items?: (FeeLineRow | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

/**
 * The fee line our server added: marked, with no product behind it and a
 * price we set. A line a storefront adds always has a variant, so a
 * marker copied onto one does not make it a fee.
 */
export const isFeeLine = (
  item: Pick<FeeLineRow, "metadata" | "variant_id" | "is_custom_price"> | null | undefined
): boolean =>
  item?.metadata?.["qt_fee"] === COD_FEE && !item.variant_id && item.is_custom_price === true

const amountOf = (raw?: MedusaAmount, plain?: MedusaAmount): Kurus =>
  fromMedusaAmount(raw ?? plain ?? 0, { allowRounding: true })

/** The cart's fee lines, and what the cart comes to without them. */
export function feeFacts(cart: FeeCart) {
  const lines = (cart.items ?? []).filter((item): item is FeeLineRow => isFeeLine(item))
  const fees = sumKurus(lines.map((line) => amountOf(line.raw_total, line.total)))
  return {
    lines,
    fees,
    base: kurus(amountOf(cart.raw_total, cart.total) - fees),
    shipping_option_ids: (cart.shipping_methods ?? []).flatMap((method) =>
      method?.shipping_option_id ? [method.shipping_option_id] : []
    ),
  }
}

/** Exactly one line for a fee, none without one. */
export const feeLinesMatch = (facts: ReturnType<typeof feeFacts>, fee: Kurus): boolean =>
  facts.fees === fee && facts.lines.length === (fee > 0 ? 1 : 0)

/** The fee for an order of `amount` kuruş (goods and shipping, no fee). */
export function codFee(settings: CashOnDeliverySettings, amount: Kurus): Kurus {
  if (settings.fee_type === "fixed") {
    return kurus(settings.fee_value)
  }
  if (settings.fee_type === "percent") {
    return multiplyByRateBps(amount, settings.fee_value)
  }
  return kurus(0)
}

/**
 * Whether the cart may be paid at the door (adr/0029 §6): the flag on, the
 * order (without the fee) within the limit, every shipping method one the
 * shop marked as collecting. Null when it may; why not, otherwise.
 */
export function codRefusal(
  settings: CashOnDeliverySettings,
  enabled: boolean,
  cart: { amount: Kurus; shipping_option_ids: readonly string[] }
): CodRefusal | null {
  if (!enabled) {
    return "cash_on_delivery.disabled"
  }
  if (settings.max_amount > 0 && cart.amount > settings.max_amount) {
    return "cash_on_delivery.over_limit"
  }
  const allowed = new Set(settings.shipping_option_ids)
  if (
    cart.shipping_option_ids.length === 0 ||
    !cart.shipping_option_ids.every((id) => allowed.has(id))
  ) {
    return "cash_on_delivery.shipping_unsupported"
  }
  return null
}
