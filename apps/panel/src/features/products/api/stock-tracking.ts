import { sdk } from "@/lib/sdk"

/**
 * A variant's stock tracking turned on or off after it was made
 * (`POST /admin/products/:id/stock-tracking`, docs/06 "Ürün sayfası"). On:
 * the server gives it an inventory item and a level at the shop's default
 * location, with the count when one is sent. Off: the flag alone; the
 * item and its count are kept for turning it back on.
 */
export interface TrackingChange {
  tracked: boolean
  /** The count at the default location; only with tracking turned on. */
  quantity?: number
}

export interface TrackingAnswer {
  variants: { id: string; manage_inventory: boolean; inventory_item_id: string | null }[]
}

const trackingUrl = (productId: string) =>
  `/admin/products/${encodeURIComponent(productId)}/stock-tracking`

/** The changes in at most two calls: the variants turned on, then those turned off. */
export async function saveTracking(
  productId: string,
  changes: readonly { variantId: string; change: TrackingChange }[]
): Promise<void> {
  for (const tracked of [true, false]) {
    const variants = changes
      .filter(({ change }) => change.tracked === tracked)
      .map(({ variantId, change }) =>
        change.quantity === undefined
          ? { id: variantId }
          : { id: variantId, quantity: change.quantity }
      )
    if (variants.length > 0) {
      await sdk.client.fetch<TrackingAnswer>(trackingUrl(productId), {
        method: "POST",
        body: { tracked, variants },
      })
    }
  }
}
