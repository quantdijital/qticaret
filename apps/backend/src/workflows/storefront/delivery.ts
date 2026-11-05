import type { MarketingSettings, ShippingSettings } from "../../modules/platform-settings/sections"

/** A span of working days, the shorter first. */
export interface DaySpan {
  min: number
  max: number
}

/**
 * When an order leaves and reaches the door, as the shop set it: the
 * working days to get it out (`shipping.handling_days_*`, the same the
 * products' `shippingDetails` and the `kargo_cümlesi` say), the carrier's
 * days (`shipping.transit_days_*`) and the hour until which an order
 * leaves the same day (`marketing.feed_same_day_cutoff_hour`, the one
 * Akakçe shows; null: not promised). Numbers only: the storefront says them.
 */
export interface StorefrontDelivery {
  handling_days: DaySpan
  transit_days: DaySpan
  same_day_cutoff_hour: number | null
}

export function storefrontDelivery(
  shipping: Pick<
    ShippingSettings,
    "handling_days_min" | "handling_days_max" | "transit_days_min" | "transit_days_max"
  >,
  marketing: Pick<MarketingSettings, "feed_same_day_cutoff_hour">
): StorefrontDelivery {
  return {
    handling_days: { min: shipping.handling_days_min, max: shipping.handling_days_max },
    transit_days: { min: shipping.transit_days_min, max: shipping.transit_days_max },
    same_day_cutoff_hour: marketing.feed_same_day_cutoff_hour,
  }
}
