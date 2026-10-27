import { fromMedusaAmount, kurus, toMedusaAmount } from "../../money"
import type { Kurus } from "../../money"

/**
 * PayTR writes amounts three ways (dev.paytr.com): the token request and
 * the notification in whole kuruş (34,56 TL → "3456"), the basket and the
 * refund in lira with a dot ("18.00"), the status query in lira with a
 * comma or a dot ("10,8", "9.76"). Every conversion lives here, at the
 * provider's edge (adr/0010); the platform only ever sees kuruş.
 */

/** `payment_amount` of the token request: whole kuruş. */
export function toPaytrKurus(amount: Kurus): string {
  if (amount <= 0) {
    throw new RangeError("a PayTR amount must be positive")
  }
  return String(amount)
}

/** A basket price or `return_amount`: lira with a dot and two decimals ("11.97"). */
export function toPaytrLira(amount: Kurus): string {
  if (amount <= 0) {
    throw new RangeError("a PayTR amount must be positive")
  }
  return toMedusaAmount(amount)
}

const WHOLE_KURUS = /^\d{1,15}$/
const LIRA = /^\d{1,13}(?:[.,]\d{1,2})?$/

/** `total_amount` and `payment_amount` of a notification: whole kuruş. */
export function parsePaytrKurus(value: string): Kurus {
  if (!WHOLE_KURUS.test(value)) {
    throw new RangeError("a PayTR kuruş amount must be a whole number")
  }
  return kurus(Number(value))
}

/**
 * Lira as the status query and the refund answer write it: a comma or a
 * dot, at most two decimals ("10,8" is 10,80 TL). Anything else, a
 * thousands separator included, is refused rather than guessed.
 */
export function parsePaytrLira(value: string | number): Kurus {
  const text = typeof value === "number" ? String(value) : value.trim()
  if (!LIRA.test(text)) {
    throw new RangeError("a PayTR lira amount must look like 10.80 or 10,8")
  }
  return fromMedusaAmount(text.replace(",", "."))
}
