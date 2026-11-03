import type { MedusaContainer } from "@medusajs/framework/types"
import { normalizeText } from "../../../../lib/search"
import { SEARCH_INDEX_MODULE } from "../../../../modules/search-index"
import type SearchIndexModuleService from "../../../../modules/search-index/service"

export interface SynonymView {
  id: string
  terms: string[]
  created_at: string
  updated_at: string
}

interface Row {
  id: string
  terms: unknown
  created_at: Date | string
  updated_at: Date | string
}

const viewOf = (row: Row): SynonymView => ({
  id: row.id,
  terms: row.terms as string[],
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString(),
})

const index = (scope: MedusaContainer) =>
  scope.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

/** One group as the panel shows it; null when there is none. */
export async function readSynonym(scope: MedusaContainer, id: string): Promise<SynonymView | null> {
  const [row] = await index(scope).listSearchSynonyms({ id }, { take: 1 })
  return row ? viewOf(row) : null
}

/**
 * The groups, the newest first; with `q`, those with a term holding it as
 * search compares words (`tisort` finds `tişört`). A shop keeps at most a
 * thousand: read whole, paged here.
 */
export async function readSynonyms(
  scope: MedusaContainer,
  options: { q?: string | undefined; offset: number; limit: number }
): Promise<{ synonyms: SynonymView[]; count: number }> {
  const rows = (await index(scope).listSearchSynonyms(
    {},
    { take: null, order: { created_at: "DESC", id: "ASC" } }
  )) as Row[]
  const wanted = normalizeText(options.q ?? "")
  const matching = wanted
    ? rows.filter((row) =>
        (row.terms as string[]).some((term) => normalizeText(term).includes(wanted))
      )
    : rows
  return {
    synonyms: matching.slice(options.offset, options.offset + options.limit).map(viewOf),
    count: matching.length,
  }
}
