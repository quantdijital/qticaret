/**
 * A moved product's thumbnail (adr/0042 §7, Ek 2026-11-20). A product
 * without one takes its first picture. When the old site's featured
 * picture could not be fetched, another stands in, and the migration's
 * own record (kind `thumbnail`, never the product's metadata, which the
 * store API may return) names the stand-in: a later run that fetches the
 * featured one puts it in its place, only while the thumbnail is still
 * that stand-in. One the shop chose since is never replaced.
 */

/** The migration record's kind that names a product's stand-in thumbnail. */
export const THUMBNAIL_KIND = "thumbnail"

/**
 * The record's key: the product's own and a word, never the product's key
 * alone (the old site's `?p=` lookups read records by it).
 */
export const standInKeyOf = (productKey: string) => `${productKey} thumbnail`

export interface ThumbnailInput {
  current: { thumbnail: string | null }
  /** The stand-in a run before set, while its record holds. */
  standIn: string | null
  /** The product's first picture once this run's are added. */
  first: string | null
  /** The featured picture's stored address, when this run stored it. */
  featured: string | null
  /** This run tried the featured picture and could not take it. */
  featuredFailed: boolean
}

export interface ThumbnailChange {
  /** The product's new thumbnail; none: left as it is. */
  thumbnail?: string
  /** The stand-in to record (an address), or null to clear the record; none: unchanged. */
  standIn?: string | null
}

export function thumbnailChange({
  current,
  standIn,
  first,
  featured,
  featuredFailed,
}: ThumbnailInput): ThumbnailChange {
  if (!current.thumbnail) {
    if (!first) {
      return {}
    }
    return featuredFailed && first !== featured
      ? { thumbnail: first, standIn: first }
      : { thumbnail: first }
  }
  if (featured && standIn !== null && standIn === current.thumbnail) {
    return { thumbnail: featured, standIn: null }
  }
  // The shop chose another since: the record has nothing left to stand for
  return standIn !== null && standIn !== current.thumbnail && featured ? { standIn: null } : {}
}
