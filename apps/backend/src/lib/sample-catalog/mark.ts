/**
 * How a sample record is known (owner, 2026-11-28): the sector pack's
 * sample catalogue marks every product and category it makes in the
 * record's own metadata, and every review by its source reference. The
 * mark travels with the record (a handle renamed, a title edited) and
 * needs no table of its own:
 * - `sample`: `<pack>@<version>`, the set it came from;
 * - `sample_of`: the record's own id. A copy (the panel's "Kopyala", an
 *   export brought back) carries the metadata but not the id, so it is
 *   the shop's own and never removed as a sample;
 * - `sample_at`: when it was made (a product changed since reads as edited).
 * A pack category the set opened (it was hidden, a sample went into it)
 * carries `sample_opened`, and is hidden again once no product is left in it.
 */

type Metadata = Record<string, unknown> | null | undefined

export const SAMPLE_KEY = "sample"
export const SAMPLE_OF_KEY = "sample_of"
export const SAMPLE_AT_KEY = "sample_at"
export const SAMPLE_OPENED_KEY = "sample_opened"

/** A review's source reference starts with this; the rest names the set, product and place. */
export const SAMPLE_REVIEW_PREFIX = "sample:"

/** The set's tag in a record's mark. */
export const sampleTag = (pack: string, version: number): string => `${pack}@${String(version)}`

/** The pack a tag names (`travel@1` → `travel`), or null for no tag. */
export const packOfTag = (tag: unknown): string | null =>
  typeof tag === "string" && /^[a-z][a-z0-9-]{1,39}@\d+$/.test(tag)
    ? (tag.split("@")[0] ?? null)
    : null

/** The mark a record is given once its id is known. */
export const sampleMark = (tag: string, id: string, at: Date): Record<string, string> => ({
  [SAMPLE_KEY]: tag,
  [SAMPLE_OF_KEY]: id,
  [SAMPLE_AT_KEY]: at.toISOString(),
})

/**
 * A record the sample catalogue made: marked, and marked as itself (a copy
 * is not). One with the set's tag and no `sample_of` key at all was being
 * made when its load stopped (a restart): never the shop's, removed with
 * the samples and never sold.
 */
export const isSampleRecord = (record: { id: string; metadata?: Metadata }): boolean => {
  if (packOfTag(record.metadata?.[SAMPLE_KEY]) === null) {
    return false
  }
  const of = record.metadata?.[SAMPLE_OF_KEY]
  return of === record.id || of === undefined
}

/** A review's source reference: the set, the product's handle in it and the review's place. */
export const sampleReviewRef = (tag: string, handle: string, index: number): string =>
  `${SAMPLE_REVIEW_PREFIX}${tag}:${handle}:${String(index + 1)}`

export const isSampleReviewRef = (ref: string | null | undefined): boolean =>
  typeof ref === "string" && ref.startsWith(SAMPLE_REVIEW_PREFIX)

// A product saved this long after it was made has been changed by someone
const EDIT_SLACK_MS = 2 * 60 * 1000

/** A sample product changed since it was made (its own fields: title, text, prices). */
export function isEditedSample(record: {
  metadata?: Metadata
  updated_at?: Date | string | null
}): boolean {
  const at = record.metadata?.[SAMPLE_AT_KEY]
  if (typeof at !== "string" || !record.updated_at) {
    return false
  }
  const made = Date.parse(at)
  const saved = new Date(record.updated_at).getTime()
  return Number.isFinite(made) && Number.isFinite(saved) && saved - made > EDIT_SLACK_MS
}

/** The keys taken off a record's metadata on its next save (Medusa merges metadata; "" drops a key). */
export const dropKeys = (keys: readonly string[]): Record<string, string> =>
  Object.fromEntries(keys.map((key) => [key, ""]))
