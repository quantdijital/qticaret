/**
 * A variant's prices as our own catalog writers change them (the import,
 * F3.9; bulk edit, F3.10). Medusa writes a variant's price set whole on
 * update and deletes what is not sent, so every price is sent back: the
 * base TRY price replaced, the others as they are. A price list's prices
 * belong to the price list (the pricing module keeps them) and stay out.
 */

export const CURRENCY = "try"

export interface ExistingPrice {
  id: string
  currency_code: string
  amount: number
  /** No rules and no quantity bounds: the plain price in its currency. */
  isBase: boolean
}

export interface PriceRow {
  id: string
  currency_code: string
  amount: number | string
  price_list_id?: string | null
  min_quantity?: number | string | null
  max_quantity?: number | string | null
  rules_count?: number | null
}

/** What `pricesOf` reads, under a product's variants. */
export const PRICE_FIELDS = [
  "variants.prices.id",
  "variants.prices.currency_code",
  "variants.prices.amount",
  "variants.prices.price_list_id",
  "variants.prices.min_quantity",
  "variants.prices.max_quantity",
  "variants.prices.rules_count",
]

/** The price set's own prices, without a price list's. */
export const pricesOf = (prices: readonly PriceRow[] | null | undefined): ExistingPrice[] =>
  (prices ?? [])
    .filter((price) => !price.price_list_id)
    .map((price) => ({
      id: price.id,
      currency_code: price.currency_code,
      amount: Number(price.amount),
      isBase:
        !price.rules_count &&
        (price.min_quantity ?? null) === null &&
        (price.max_quantity ?? null) === null,
    }))

export const isBaseTry = (price: ExistingPrice): boolean =>
  price.currency_code === CURRENCY && price.isBase

/** The variant's base TRY price, if it has one. */
export const baseTryOf = (prices: readonly ExistingPrice[]): ExistingPrice | undefined =>
  prices.find(isBaseTry)

/** The base TRY price replaced, every other price of the set kept as it is (its rules too). */
export function nextPrices(prices: readonly ExistingPrice[], amount: number) {
  const base = baseTryOf(prices)
  return [
    ...prices
      .filter((price) => price !== base)
      .map(({ id, currency_code, amount: kept }) => ({ id, currency_code, amount: kept })),
    { ...(base ? { id: base.id } : {}), currency_code: CURRENCY, amount },
  ]
}
