/**
 * A review form's photos (adr/0037 §4 Ek 2026-11-04) as the action reads
 * them: up to three image files, each within the backend's upload limit.
 * The backend checks every one again by its bytes; this only keeps an
 * obvious mistake (a PDF, a fourth photo) from a round trip.
 */

export const REVIEW_PHOTOS_MAX = 3
// The backend's per-file limit (docs/04); the form's whole body is capped in next.config
export const REVIEW_PHOTO_BYTES = 10 * 1024 * 1024
export const REVIEW_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const

/**
 * The chosen photos; an empty file input (nothing chosen) is none. Null
 * when what was sent cannot be a review's photos: too many, too big, not
 * one of the accepted types.
 */
export function reviewPhotoFiles(form: FormData): File[] | null {
  const files = form
    .getAll("photos")
    .filter((entry): entry is File => typeof entry !== "string" && entry.size > 0)
  if (files.length > REVIEW_PHOTOS_MAX) {
    return null
  }
  const fits = (file: File) =>
    file.size <= REVIEW_PHOTO_BYTES && (REVIEW_PHOTO_TYPES as readonly string[]).includes(file.type)
  return files.every(fits) ? files : null
}
