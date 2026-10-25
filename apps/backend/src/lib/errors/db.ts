import { RetryableError } from "./errors"

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

// Medusa's locking module, in memory and in Redis alike
const LOCK_TIMEOUT = "Failed to acquire lock for key "
// How long a client waits before trying a busy record again
const LOCK_RETRY_AFTER_MS = 2_000

/**
 * A lock that could not be taken in time (two saves of one product, two
 * enqueues of one job type) as a RetryableError: 503 with Retry-After
 * instead of a 500, and the lock key (an ID) out of the answer.
 */
export function lockTimeoutError(error: unknown): RetryableError | null {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === "string" && message.startsWith(LOCK_TIMEOUT)
    ? new RetryableError("errors.busy", { retryAfterMs: LOCK_RETRY_AFTER_MS })
    : null
}
