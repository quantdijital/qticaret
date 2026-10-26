import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"

/** A price row as the pricing module lists it (F4.1). */
export interface PriceRow {
  id: string
  raw_amount?: MedusaAmount | null
  amount?: MedusaAmount | null
  currency_code: string
  price_set_id: string
  price_list_id?: string | null
  rules_count?: number | null
  min_quantity?: MedusaAmount | null
  max_quantity?: MedusaAmount | null
}

export const PRICE_ROW_FIELDS = [
  "id",
  "amount",
  "raw_amount",
  "currency_code",
  "price_set_id",
  "price_list_id",
  "rules_count",
  "min_quantity",
  "max_quantity",
]

/**
 * A price for anyone, any quantity: no rules (a region, a group) and no
 * quantity tier. A variant's own price is its plain price outside lists.
 */
export const isPlainPrice = (row: PriceRow): boolean =>
  !row.rules_count &&
  (row.min_quantity === null || row.min_quantity === undefined) &&
  (row.max_quantity === null || row.max_quantity === undefined)

/** A price's amount in kuruş; a row read without its amount is a mistake, not a free price (adr/0010). */
export function kurusOfRow(row: PriceRow): Kurus {
  const amount = row.raw_amount ?? row.amount
  if (amount === null || amount === undefined) {
    throw new RangeError(`price ${row.id} has no amount`)
  }
  return fromMedusaAmount(amount, { allowRounding: true })
}
