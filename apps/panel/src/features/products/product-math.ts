/**
 * Facts a product list or page shows, worked out from what the API
 * returned: a price range in the shop's currency, the stock that can be
 * sold. Pure, so it is tested on its own.
 */

interface PriceRow {
  amount?: number | null
  currency_code?: string | null
}

interface LevelRow {
  available_quantity?: number | null
}

export interface VariantRow {
  manage_inventory?: boolean | null
  prices?: (PriceRow | null)[] | null
  inventory_items?:
    ({ inventory?: { location_levels?: (LevelRow | null)[] | null } | null } | null)[] | null
}

export function priceRange(
  variants: (VariantRow | null)[] | null | undefined,
  currency: string
): { min: number; max: number } | null {
  const amounts = (variants ?? []).flatMap((variant) =>
    (variant?.prices ?? []).flatMap((price) =>
      price?.currency_code === currency && typeof price.amount === "number" ? [price.amount] : []
    )
  )
  return amounts.length ? { min: Math.min(...amounts), max: Math.max(...amounts) } : null
}

/** Units that can be sold across locations; null when no variant tracks stock. */
export function availableStock(variants: (VariantRow | null)[] | null | undefined): number | null {
  const tracked = (variants ?? []).filter((variant) => variant?.manage_inventory)
  if (tracked.length === 0) {
    return null
  }
  return tracked.reduce(
    (sum, variant) =>
      sum +
      (variant?.inventory_items ?? []).reduce(
        (inner, item) =>
          inner +
          (item?.inventory?.location_levels ?? []).reduce(
            (levels, level) => levels + (level?.available_quantity ?? 0),
            0
          ),
        0
      ),
    0
  )
}
