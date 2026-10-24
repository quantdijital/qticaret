const SUFFIX = ", already exists."
const KEY = /(?:^|, )([a-z_][a-z0-9_]*): /g

/**
 * Columns of the unique index a write violated, read from the text Medusa's
 * dbErrorMapper builds in the service layer ("Url entry with locale: tr,
 * path: /x, already exists."); null for any other error. Medusa does not
 * export the mapper and the Postgres code is gone by then, so the text is
 * all there is; the url-registry module tests pin it against a real insert.
 */
export function uniqueViolationKeys(error: unknown): string[] | null {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message !== "string" || !message.endsWith(SUFFIX)) {
    return null
  }
  const start = message.indexOf(" with ")
  if (start === -1) {
    return null
  }
  const fields = message.slice(start + " with ".length, -SUFFIX.length)
  return Array.from(fields.matchAll(KEY), (match) => match[1] ?? "")
}
