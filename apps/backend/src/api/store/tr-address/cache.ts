import type { MedusaResponse } from "@medusajs/framework/http"

/**
 * Address reference data changes about once a year (adr/0008), so shared
 * caches may keep it for an hour and serve it stale while revalidating.
 */
export function setReferenceDataCache(res: MedusaResponse): void {
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
}
