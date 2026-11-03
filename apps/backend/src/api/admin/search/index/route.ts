import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEARCH_INDEX_MODULE } from "../../../../modules/search-index"
import type SearchIndexModuleService from "../../../../modules/search-index/service"

/**
 * GET /admin/search/index (adr/0056): what site search's index holds now,
 * `{ documents, pending, last_rebuilt_at, dictionary_words, synonyms }`.
 * Counts only, nothing of a product: every staff role reads it.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await req.scope.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).indexStatus())
}
