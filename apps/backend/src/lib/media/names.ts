/** What the library shows as a file's name; a rename takes no more. */
export const MEDIA_NAME_MAX = 200

// Local storage puts a timestamp before the name (`1792…-kupa.jpg`), S3 a
// ULID after it (`kupa-01J….jpg`); neither is part of the name a person gave
const STAMP = /^\d{10,}-/
const ULID = /-[0-9A-HJKMNP-TV-Z]{26}(?=\.[^.]+$|$)/i

/**
 * A stored file's name as people know it, from its storage key or address:
 * the last segment, without the prefix or suffix storage added. The key
 * itself is not touched: the file's address stays as it is.
 */
export function displayName(keyOrUrl: string): string {
  const last = keyOrUrl.split(/[\\/]/).pop() ?? ""
  let decoded = last
  try {
    decoded = decodeURIComponent(last)
  } catch {
    // A broken escape ("%E0") is shown as it is
  }
  const tidy = decoded.replace(STAMP, "").replace(ULID, "")
  return (tidy || decoded || "file").slice(0, MEDIA_NAME_MAX)
}
