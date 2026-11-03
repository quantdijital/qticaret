import { ZERO_KURUS, addKurus, fromMedusaAmount, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import type { InvoiceItem } from "./lines"

type Rows<T> = (T | null)[] | null | undefined

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

/**
 * A gift card is a payment instrument (the shop's accountant,
 * docs/mali-musavir-sorulari.md 3.2, final 2026-11-03): selling one is no
 * sale but money taken in advance (avans); its KDV arises when it is
 * spent, on the invoice of what it buys. So an invoice leaves the gift
 * card lines out, and what the buyer paid for them (KDV included, after
 * any discount) is kept beside it as the advance. Whatever is left is the
 * invoice's: what was charged less the advance. Pure.
 */
export function splitAdvance<T extends { items?: Rows<InvoiceItem> }>(
  order: T,
  giftLines: ReadonlySet<string>
): { order: T; advance: string } {
  let advance = ZERO_KURUS
  const items = (order.items ?? []).filter((item) => {
    if (item?.id && giftLines.has(item.id)) {
      advance = addKurus(advance, kurusOf(item.total))
      return false
    }
    return true
  })
  return { order: { ...order, items }, advance: toMedusaAmount(advance) }
}

/** The loyalty plugin's mark on a cart's or an order's credit line paid with a gift card. */
export const GIFT_CARD_CREDIT = "gift-card"

export interface CreditLineRow {
  reference?: string | null
  /** Read as `raw_amount`: the number Query also returns loses digits (adr/0010). */
  raw_amount?: MedusaAmount | null
  version?: number | null
}

/**
 * What gift cards paid of the order, in kuruş: its credit lines the
 * plugin marked as a card's, of the order's current version (Medusa copies
 * them into each), a store credit's left out; one given back (negative)
 * is not a card spent.
 */
export function giftCardSpent(order: {
  version?: number | null
  credit_lines?: Rows<CreditLineRow>
}): Kurus {
  const version = order.version ?? null
  return (order.credit_lines ?? []).reduce<Kurus>((sum, line) => {
    if (line?.reference !== GIFT_CARD_CREDIT || (version !== null && line.version !== version)) {
      return sum
    }
    const amount = kurusOf(line.raw_amount)
    return amount > 0 ? addKurus(sum, amount) : sum
  }, ZERO_KURUS)
}
