import type { MedusaResponse } from "@medusajs/framework/http"

/**
 * Address reference data changes about once a year (adr/0008), so shared
 * caches may keep it for an hour and serve it stale while revalidating.
 * Varying on the publishable key keeps a cache from answering requests that
 * lack one, which Medusa would reject.
 */
export function setReferenceDataCache(res: MedusaResponse): void {
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
  res.setHeader("Vary", "x-publishable-api-key")
}
