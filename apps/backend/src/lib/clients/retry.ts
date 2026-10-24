import { integerOption } from "./request"

export interface RetryPolicy {
  /** Tries in total, the first included. */
  attempts: number
  baseDelayMs: number
  maxDelayMs: number
  /** A longer Retry-After is not waited for; the error carries it instead. */
  maxRetryAfterMs: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  maxRetryAfterMs: 10_000,
}

/** The default policy with a client's overrides, each checked. */
export function resolveRetryPolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  const policy = { ...DEFAULT_RETRY_POLICY, ...overrides }
  return {
    attempts: integerOption("attempts", policy.attempts, 3, 1),
    baseDelayMs: integerOption("baseDelayMs", policy.baseDelayMs, 200, 0),
    maxDelayMs: integerOption("maxDelayMs", policy.maxDelayMs, 5_000, 0),
    maxRetryAfterMs: integerOption("maxRetryAfterMs", policy.maxRetryAfterMs, 10_000, 0),
  }
}

// Safe to send twice; a POST only when the caller says so (an idempotency key)
export const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "PUT",
  "DELETE",
  "OPTIONS",
])

/** Exponential backoff with full jitter: a random delay up to base × 2^attempt, capped. */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt)
  return Math.floor(random() * ceiling)
}

/** Retry-After in seconds or as an HTTP date, in milliseconds from now; undefined when absent or unreadable. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now()
): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined
  }
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000
  }
  // An HTTP date names a day and month; Date.parse alone also reads "-1"
  const date = /[a-z]/i.test(trimmed) ? Date.parse(trimmed) : Number.NaN
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}
