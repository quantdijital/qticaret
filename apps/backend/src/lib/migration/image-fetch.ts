import type { SafeFetchOptions, SafeFetchResponse } from "../security/safe-fetch"
import { isSafeFetchError, safeFetch } from "../security/safe-fetch"
import { DEFAULT_UPLOAD_LIMITS } from "../security/upload"
import { FetchPace } from "./fetch-pace"

/**
 * A picture's bytes from the old site (F14.4, adr/0042 §7, Ek 2026-11-20),
 * under the SSRF rules (docs/04, KK4): public addresses only, every
 * redirect checked again, the upload size cap. A fake provider's own
 * origin (development, tests) is reached directly, without redirects.
 *
 * An old host often turns a run's requests away for a while (429, a 5xx,
 * a slow answer): such a failure is tried again after a growing, jittered
 * wait (the host's `Retry-After` where it gives one), and the run's pace
 * slows (`FetchPace`). A picture that still fails is refused with why: its
 * key names the answer (`migration.image_unreachable_<reason>`).
 */

const FETCH_TIMEOUT_MS = 30_000
/** Tries a picture gets in all, the first included. */
export const IMAGE_ATTEMPTS = 4
const BASE_WAIT_MS = 1_000
const MAX_WAIT_MS = 30_000

/** A picture not taken, and why (an error key for the report). */
export class ImageRefused extends Error {
  constructor(
    readonly key: string,
    /** Whether another try may fetch it: the host was busy or failing, not refusing it. */
    readonly retryable = false,
    /** The host's own wait, from `Retry-After`. */
    readonly retryAfterMs: number | null = null
  ) {
    super(key)
  }
}

const REFUSALS: Readonly<Record<string, string>> = {
  address_not_allowed: "migration.image_address_refused",
  protocol_not_allowed: "migration.image_address_refused",
  credentials_in_url: "migration.image_address_refused",
  port_not_allowed: "migration.image_address_refused",
  invalid_url: "migration.image_address_refused",
  redirect_not_allowed: "migration.image_address_refused",
  response_too_large: "migration.image_too_large",
  timeout: "migration.image_unreachable_timeout",
}

const unreachable = (reason: string) => `migration.image_unreachable_${reason}`

/** The reason a non-200 answer gives, and whether to try again. */
export function statusReason(status: number): { key: string; retryable: boolean } {
  if (status === 404 || status === 410) {
    return { key: unreachable("not_found"), retryable: false }
  }
  if (status === 401 || status === 403) {
    return { key: unreachable("forbidden"), retryable: false }
  }
  if (status === 429) {
    return { key: unreachable("throttled"), retryable: true }
  }
  if (status >= 500 && status <= 599) {
    return { key: unreachable("server"), retryable: true }
  }
  // 408: the host gave up waiting for us
  if (status === 408) {
    return { key: unreachable("timeout"), retryable: true }
  }
  return { key: unreachable("status"), retryable: false }
}

/** `Retry-After` as a wait: seconds, or an HTTP date; capped; none for a bad one. */
export function retryAfterMs(value: string | string[] | null | undefined, now = Date.now()) {
  const text = (Array.isArray(value) ? value[0] : value)?.trim()
  if (!text) {
    return null
  }
  const wait = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - now
  return Number.isFinite(wait) ? Math.min(Math.max(wait, 0), MAX_WAIT_MS) : null
}

/** The wait before try `attempt` + 1 (from 0): doubling, capped, with full jitter in its upper half. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

type Headers = Record<string, string | string[] | undefined>

function refusedAnswer(status: number, headers: Headers): ImageRefused {
  const { key, retryable } = statusReason(status)
  return new ImageRefused(key, retryable, retryable ? retryAfterMs(headers["retry-after"]) : null)
}

export interface ImageFetchDeps {
  fetch?: typeof fetch
  safeFetch?: (url: URL, options: SafeFetchOptions) => Promise<SafeFetchResponse>
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// One try: the bytes, or why not
async function fetchOnce(url: URL, fake: string | undefined, deps: ImageFetchDeps) {
  try {
    if (fake && new URL(fake).origin === url.origin) {
      const answer = await (deps.fetch ?? fetch)(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (answer.status !== 200) {
        throw refusedAnswer(answer.status, Object.fromEntries(answer.headers.entries()))
      }
      return Buffer.from(await answer.arrayBuffer())
    }
    const answer = await (deps.safeFetch ?? safeFetch)(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxResponseBytes: DEFAULT_UPLOAD_LIMITS.maxBytes,
      maxRedirects: 3,
      redirect: "follow",
    })
    if (answer.status !== 200) {
      throw refusedAnswer(answer.status, answer.headers)
    }
    return answer.body
  } catch (error) {
    if (error instanceof ImageRefused) {
      throw error
    }
    if (isSafeFetchError(error)) {
      const known = REFUSALS[error.reason]
      if (known) {
        throw new ImageRefused(known, error.reason === "timeout")
      }
      if (error.reason === "too_many_redirects") {
        throw new ImageRefused(unreachable("status"))
      }
      // DNS, a dropped connection, a reset: the host may be back in a moment
      throw new ImageRefused(unreachable("network"), true)
    }
    const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError"
    throw new ImageRefused(unreachable(timedOut ? "timeout" : "network"), true)
  }
}

/**
 * The picture at `address`, tried up to IMAGE_ATTEMPTS times while the
 * host is busy or failing, each try in turn with the run's other fetches
 * (`pace`). Throws `ImageRefused` with the last answer's reason.
 */
export async function downloadImage(
  address: string,
  fake: string | undefined,
  pace: FetchPace = new FetchPace(),
  deps: ImageFetchDeps = {}
): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw new ImageRefused("migration.image_address_refused")
  }
  const sleep = deps.sleep ?? pause
  const host = url.host
  let timeouts = 0
  for (let attempt = 0; ; attempt++) {
    // A host given up for the run, or a spent budget: left for a later run, at once
    const tripped = pace.trippedBy(host)
    if (tripped) {
      throw new ImageRefused(tripped)
    }
    if (pace.expired()) {
      throw new ImageRefused(unreachable("deferred"))
    }
    try {
      const body = await pace.run(() => fetchOnce(url, fake, deps))
      pace.succeeded(host)
      return body
    } catch (error) {
      if (!(error instanceof ImageRefused) || !error.retryable) {
        throw error
      }
      pace.refused(error.retryAfterMs, host, error.key)
      // A slow answer costs the whole timeout: tried again once only
      timeouts += error.key === unreachable("timeout") ? 1 : 0
      if (attempt + 1 >= IMAGE_ATTEMPTS || timeouts > 1) {
        throw error
      }
      await sleep(Math.max(backoffMs(attempt, deps.random), error.retryAfterMs ?? 0))
    }
  }
}
