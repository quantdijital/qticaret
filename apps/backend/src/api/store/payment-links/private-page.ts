import type { MedusaResponse } from "@medusajs/framework/http"

/** A link page is the customer's alone: kept by no cache, leaked to no site, found by no search. */
export function privatePage(res: MedusaResponse): void {
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
}
