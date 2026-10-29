import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { turkishDay } from "../../lib/dashboard"
import { errorSummary, logger } from "../../lib/logging"
import { normalizeSearchTerm } from "../../lib/search"
import { SEARCH_TERMS_MODULE } from "../../modules/search-terms"
import type SearchTermsModuleService from "../../modules/search-terms/service"

/**
 * A storefront product search counted (F11.8, adr/0039 §8): its words and
 * whether it found anything, read from the answer Medusa sends. Only the
 * first page is a search (a next page is the same one); a term that may
 * hold a person is not counted. Counting never slows or fails the answer.
 */
export function recordSearchTerms(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const term = normalizeSearchTerm(req.query["q"])
  const offset = Number(req.query["offset"] ?? 0)
  if (!term || offset > 0) {
    next()
    return
  }
  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    const count = (body as { count?: unknown } | null)?.count
    if (res.statusCode < 400 && typeof count === "number") {
      req.scope
        .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
        .record(turkishDay(new Date()), term, count)
        .catch((error: unknown) => {
          logger.warn({ event: "search_terms.record_failed", err: errorSummary(error) })
        })
    }
    return json(body)
  }
  next()
}
