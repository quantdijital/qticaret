import { kurus } from "../money"
import type { Kurus } from "../money"
import type { CashOnDeliverySettings } from "../../modules/platform-settings/sections"

/** Marks the cart line that carries the fee (adr/0029): set on the server only. */
export const COD_FEE = "cash_on_delivery"

export type CodRefusal =
  | "cash_on_delivery.disabled"
  | "cash_on_delivery.over_limit"
  | "cash_on_delivery.shipping_unsupported"

/** The fee for an order of `amount` kuruş (goods and shipping, no fee). */
export function codFee(settings: CashOnDeliverySettings, amount: Kurus): Kurus {
  if (settings.fee_type === "fixed") {
    return kurus(settings.fee_value)
  }
  if (settings.fee_type === "percent") {
    return kurus(Math.round((amount * settings.fee_value) / 10_000))
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
