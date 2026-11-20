/**
 * A moved product's thumbnail (adr/0042 §7, Ek 2026-11-20). A product
 * without one takes its first picture. When the old site's featured
 * picture could not be fetched, another stands in, and the product's
 * metadata names the stand-in: a later run that fetches the featured one
 * puts it in its place, only while the thumbnail is still that stand-in.
 * One the shop chose since is never replaced.
 */

/** Product metadata: the thumbnail the migration set in the featured picture's place. */
export const THUMBNAIL_STAND_IN = "migration_thumbnail_stand_in"

export interface ThumbnailInput {
  current: { thumbnail: string | null; metadata: Record<string, unknown> | null }
  /** The product's first picture once this run's are added. */
  first: string | null
  /** The featured picture's stored address, when this run stored it. */
  featured: string | null
  /** This run tried the featured picture and could not take it. */
  featuredFailed: boolean
}

export function thumbnailChange({ current, first, featured, featuredFailed }: ThumbnailInput): {
  thumbnail?: string
  metadata?: Record<string, unknown>
} {
  const metadata = current.metadata ?? {}
  if (!current.thumbnail) {
    if (!first) {
      return {}
    }
    return featuredFailed && first !== featured
      ? { thumbnail: first, metadata: { ...metadata, [THUMBNAIL_STAND_IN]: first } }
      : { thumbnail: first }
  }
  const standIn = metadata[THUMBNAIL_STAND_IN]
  if (featured && typeof standIn === "string" && standIn === current.thumbnail) {
    return { thumbnail: featured, metadata: { ...metadata, [THUMBNAIL_STAND_IN]: null } }
  }
  return {}
}
