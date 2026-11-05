import type { MarketingSettings, ShippingSettings } from "../../modules/platform-settings/sections"

/**
 * The hour until which an order leaves the same day (1–23, Turkey); null:
 * not promised. Kept with the shipping rules since adr/0046 Ek 2026-11-06;
 * a shop that set it before, under the feed rules, keeps that hour until it
 * saves one under Kargo (no data migration: the old field is read here).
 */
export const sameDayCutoffHour = (
  shipping: Pick<ShippingSettings, "same_day_cutoff_hour">,
  marketing: Pick<MarketingSettings, "feed_same_day_cutoff_hour">
): number | null => shipping.same_day_cutoff_hour ?? marketing.feed_same_day_cutoff_hour
