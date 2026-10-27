import { kurus } from "../../money"
import type { Kurus } from "../../money"
import { toPaytrLira } from "./amounts"
import type { PaytrBasketLine } from "./types"

/** Field rules and encodings of PayTR's forms and answers, apart from the calls. */

export const MERCHANT_OID = /^[A-Za-z0-9]{1,64}$/

const CURRENCIES: Readonly<Record<string, string>> = {
  try: "TL",
  eur: "EUR",
  usd: "USD",
  gbp: "GBP",
  rub: "RUB",
}

export const flag = (value: boolean): "1" | "0" => (value ? "1" : "0")

export function assertMerchantOid(merchantOid: string): void {
  if (!MERCHANT_OID.test(merchantOid)) {
    throw new RangeError("merchant_oid must be 1–64 letters and digits")
  }
}

export function toPaytrCurrency(currencyCode: string): string {
  const currency = CURRENCIES[currencyCode.toLowerCase()]
  if (!currency) {
    throw new RangeError("PayTR takes TRY, EUR, USD, GBP and RUB only")
  }
  return currency
}

export const fromPaytrCurrency = (currency: string): string =>
  currency === "TL" ? "try" : currency.toLowerCase()

/** `user_basket`: base64 of `[[name, "unit price", quantity], …]`. */
export function encodeBasket(basket: readonly PaytrBasketLine[]): string {
  if (basket.length === 0) {
    throw new RangeError("a PayTR basket needs at least one line")
  }
  const lines = basket.map((line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError("a basket quantity must be a positive whole number")
    }
    return [line.name, toPaytrLira(line.price), line.quantity]
  })
  return Buffer.from(JSON.stringify(lines), "utf8").toString("base64")
}

export const lastFour = (maskedPan: string | undefined): string | null => {
  const digits = maskedPan?.match(/(\d{4})$/)?.[1]
  return digits ?? null
}

export function parseRates(oranlar: Record<string, Record<string, string>>) {
  const rates: Record<string, Record<number, number>> = {}
  for (const [family, entries] of Object.entries(oranlar)) {
    const byCount: Record<number, number> = {}
    for (const [key, value] of Object.entries(entries)) {
      const count = Number(/^taksit_(\d{1,2})$/.exec(key)?.[1])
      const rate = Number(value)
      if (Number.isInteger(count) && Number.isFinite(rate) && rate >= 0) {
        byCount[count] = rate
      }
    }
    rates[family] = byCount
  }
  return rates
}

/**
 * The shared payment basket (`lib/payments/basket`) as PayTR lists it: a
 * unit price and a quantity. A line whose amount the quantity does not
 * divide (a discount or credit share) goes as one line of its whole
 * amount, the quantity in its name, so the lines still add up to the payment.
 */
export function paytrBasketOf(
  lines: readonly { name: string; quantity: number; amount: Kurus }[]
): PaytrBasketLine[] {
  return lines.map((line) =>
    line.amount % line.quantity === 0
      ? { name: line.name, price: kurus(line.amount / line.quantity), quantity: line.quantity }
      : { name: `${line.name} (${String(line.quantity)} adet)`, price: line.amount, quantity: 1 }
  )
}
