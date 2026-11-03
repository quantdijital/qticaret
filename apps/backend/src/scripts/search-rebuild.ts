import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { searchIndexNightly } from "../workflows/search/upkeep"

/**
 * `pnpm --filter @qticaret/backend search:rebuild` (adr/0056): the whole
 * search index made again now, as the nightly job does: every product,
 * the popularity of the last 30 days, the word dictionary. Safe while the
 * shop runs; catalogue writes go on.
 */
export default async function searchRebuild({ container }: ExecArgs) {
  const started = Date.now()
  const result = await searchIndexNightly(container)
  logger.info({ event: "search_index.rebuilt", ...result, took_ms: Date.now() - started })
}
