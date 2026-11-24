import type { MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { DATED_PARAMS } from "../../lib/seo/facets-dated"

/**
 * A listing's own budget while its query asks dates (adr/0077 §5 Ek): a
 * date search prices its products over their departures, a heavier read
 * than a listing's. Read off the raw query before it is checked; a query
 * that is not one string asks nothing here (the check refuses it).
 */
export function datedListingProfile(req: Pick<MedusaRequest, "query">): RateLimitProfile | null {
  const raw = (req.query as Record<string, unknown> | undefined)?.["query"]
  if (typeof raw !== "string") {
    return null
  }
  const params = new URLSearchParams(raw)
  return params.has(DATED_PARAMS.dates) || params.has(DATED_PARAMS.months)
    ? RATE_LIMIT_PROFILES.dated_listing
    : null
}
