import type { MedusaContainer } from "@medusajs/framework/types"
import { turkishDay } from "../../../lib/dashboard"
import { finding } from "../../../lib/seo/audit"
import type { AuditFinding } from "../../../lib/seo/audit"
import { SEARCH_TERMS_MODULE } from "../../../modules/search-terms"
import type SearchTermsModuleService from "../../../modules/search-terms/service"

const DAY_MS = 24 * 60 * 60 * 1000
// docs/14 S-SEARCH-01: searched this often in the last month and found nothing
const WINDOW_DAYS = 30
const MIN_ZERO = 3
const LISTED = 20

/**
 * S-SEARCH-01: what shoppers searched for on the storefront and did not
 * find, often enough to be a product, a page or a focus keyword missing.
 */
export async function searchFinding(
  container: MedusaContainer,
  now: Date
): Promise<AuditFinding | null> {
  const terms = await container
    .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
    .ranked(turkishDay(new Date(now.getTime() - WINDOW_DAYS * DAY_MS)), turkishDay(now), {
      limit: 200,
      zeroOnly: true,
    })
  const missing = terms.filter((term) => term.zero_results >= MIN_ZERO)
  return finding(
    "S-SEARCH-01",
    missing.slice(0, LISTED).map((term) => ({
      reason: "zero_results",
      subject: term.term,
      count: term.zero_results,
    })),
    missing.length
  )
}
