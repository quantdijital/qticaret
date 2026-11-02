import type { RefreshScope } from "../storefront/refresh"
import { GA4_PROVIDER, META_PROVIDER } from "./client"

/**
 * The browser tags' ids for the storefront (F18, adr/0038 §4): GA4's
 * measurement id and Meta's pixel id from the shop's connected accounts,
 * in `GET /store/seo/site`. Both are public (every page that loads the
 * tag prints them); nothing else of the account leaves, and an id the
 * storefront could not put in a script tag safely is left out.
 */
export interface StorefrontTracking {
  ga4_measurement_id: string | null
  meta_pixel_id: string | null
}

/** Accounts whose saves change the storefront's tags. */
const TRACKING_PROVIDERS: readonly string[] = [GA4_PROVIDER, META_PROVIDER]

/** A save or disconnect of one refreshes the storefront's `site` answer (adr/0048 Ek). */
export const trackingScopes = (provider: string): RefreshScope[] =>
  TRACKING_PROVIDERS.includes(provider) ? ["site"] : []

const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{4,12}$/
const META_PIXEL_ID = /^\d{6,20}$/

interface SettingsSource {
  settings: Record<string, unknown>
}

const idOf = (account: SettingsSource | null, field: string, pattern: RegExp): string | null => {
  const value = account?.settings[field]
  return typeof value === "string" && pattern.test(value) ? value : null
}

/** Only the two ids, each when it is set and well formed. */
export const storefrontTrackingOf = (accounts: {
  ga4: SettingsSource | null
  meta: SettingsSource | null
}): StorefrontTracking => ({
  ga4_measurement_id: idOf(accounts.ga4, "measurement_id", GA4_MEASUREMENT_ID),
  meta_pixel_id: idOf(accounts.meta, "pixel_id", META_PIXEL_ID),
})
