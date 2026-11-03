import type { Executor } from "../types"

/**
 * What the search index holds now (adr/0056), for the panel: counts of
 * the module's own tables in one statement. Exact counts: a shop's index
 * is small enough (a row per product, a word per distinct word) that a
 * scan of each costs milliseconds, and the panel reads it on demand.
 */

export interface IndexStatus {
  /** Product rows, published or not. */
  documents: number
  /** Products waiting to be indexed again. */
  pending: number
  /**
   * When the index was last made whole: the oldest row's write. A rebuild
   * (nightly, or by hand) writes every row again, so every row is at least
   * this fresh; a product that failed to index keeps it back. Null when
   * the index is empty.
   */
  last_rebuilt_at: string | null
  /** Words the typo and suggestion lookups know. */
  dictionary_words: number
  /** The shop's synonym groups. */
  synonyms: number
}

export interface StatusRow {
  documents: number | string
  pending: number | string
  last_rebuilt_at: Date | string | null
  dictionary_words: number | string
  synonyms: number | string
}

const STATUS = `
  WITH d AS (
    SELECT count(*)::integer AS documents, min(indexed_at) AS last_rebuilt_at FROM search_document
  )
  SELECT d.documents, d.last_rebuilt_at,
         (SELECT count(*)::integer FROM search_pending) AS pending,
         (SELECT count(*)::integer FROM search_word) AS dictionary_words,
         (SELECT count(*)::integer FROM search_synonym WHERE deleted_at IS NULL) AS synonyms
    FROM d`

/** The row as the API gives it: numbers, and the time as ISO 8601. */
export function indexStatusOf(row: StatusRow | undefined): IndexStatus {
  const at = row?.last_rebuilt_at ?? null
  return {
    documents: Number(row?.documents ?? 0),
    pending: Number(row?.pending ?? 0),
    last_rebuilt_at: at === null ? null : new Date(at).toISOString(),
    dictionary_words: Number(row?.dictionary_words ?? 0),
    synonyms: Number(row?.synonyms ?? 0),
  }
}

export async function indexStatus(db: Executor): Promise<IndexStatus> {
  const [row] = (await db.execute(STATUS, [])) as StatusRow[]
  return indexStatusOf(row)
}
