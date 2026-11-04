import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { SEARCH_INDEX_MODULE } from "../modules/search-index"
import type SearchIndexModuleService from "../modules/search-index/service"
import type { IndexStatus } from "../modules/search-index/sql/status"

/**
 * `pnpm --filter @qticaret/backend search:status` (adr/0056): what the
 * search index holds now, for the platform's operator beside
 * `search:rebuild`: product rows, products waiting, when it was last made
 * whole, dictionary words, synonym groups. Counts only; reads, never
 * writes. The shop's panel does not show it: the index looks after itself.
 */
export default async function searchStatus({ container }: ExecArgs): Promise<IndexStatus> {
  const status = await container
    .resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
    .indexStatus()
  logger.info({ event: "search_index.status", ...status })
  return status
}
