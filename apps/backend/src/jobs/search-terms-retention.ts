import type { MedusaContainer } from "@medusajs/framework/types"
import { turkishDay } from "../lib/dashboard"
import { logger } from "../lib/logging"
import { SEARCH_TERMS_MODULE } from "../modules/search-terms"
import type SearchTermsModuleService from "../modules/search-terms/service"

// adr/0039 §8: search terms are kept this long
const KEEP_DAYS = 180

/** Search term days older than KEEP_DAYS go (F11.8). */
export default async function searchTermsRetention(container: MedusaContainer) {
  const before = turkishDay(new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000))
  const removed = await container
    .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
    .prune(before)
  if (removed > 0) {
    logger.info({ event: "search_terms.pruned", removed })
  }
}

export const config = {
  name: "search-terms-retention",
  schedule: "40 3 * * *",
}
