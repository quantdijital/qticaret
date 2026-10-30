import type Redis from "ioredis"
import { parseEnv } from "../env"
import { ProviderError } from "../errors"
import { currentRequestId, errorSummary, logger } from "../logging"
import { createRedisClient, tenantNamespace } from "../redis"

/**
 * The last calls a provider failed (F12.2, adr/0002 ek): what the
 * Integrations page shows as "last errors". Codes only, as the log line
 * has them: no body, header, query or message; the path as the log writes
 * it. Kept in Redis, every instance's in one list per provider, the last
 * twenty for a month; in process memory without Redis (dev, tests).
 */

export interface ProviderFailure {
  at: string
  /** `timeout`, `http_500`, `invalid_response`, a provider's own code. */
  code: string
  /** The HTTP status, when the provider answered. */
  status: number | null
  method: string
  path: string
  request_id: string | null
}

export interface FailureLog {
  note: (provider: string, failure: ProviderFailure) => Promise<void>
  recent: (provider: string, limit: number) => Promise<ProviderFailure[]>
}

const KEPT = 20
const KEPT_MS = 30 * 24 * 60 * 60 * 1000

// Answers that are the provider's word on what was asked, not a broken connection:
// not found, a conflict, a refused input. A wrong account (401, 403), a bad
// request (400), throttling and outages are the integration's
const NOT_A_FAILURE = new Set([404, 409, 422])

/** Whether a failed call says something about the integration itself. */
export const worthNoting = (status: number | null): boolean =>
  status === null || !NOT_A_FAILURE.has(status)

export function createMemoryFailureLog(now: () => number = Date.now): FailureLog {
  const lists = new Map<string, ProviderFailure[]>()
  const fresh = (failure: ProviderFailure) => now() - Date.parse(failure.at) < KEPT_MS
  return {
    note: (provider, failure) => {
      lists.set(provider, [failure, ...(lists.get(provider) ?? [])].slice(0, KEPT))
      return Promise.resolve()
    },
    recent: (provider, limit) =>
      Promise.resolve((lists.get(provider) ?? []).filter(fresh).slice(0, limit)),
  }
}

export function createRedisFailureLog(client: () => Redis, prefix: string): FailureLog {
  const key = (provider: string) => `${prefix}${provider}`
  return {
    note: async (provider, failure) => {
      await client()
        .multi()
        .lpush(key(provider), JSON.stringify(failure))
        .ltrim(key(provider), 0, KEPT - 1)
        .pexpire(key(provider), KEPT_MS)
        .exec()
    },
    recent: async (provider, limit) =>
      (await client().lrange(key(provider), 0, limit - 1)).flatMap((raw) => {
        try {
          return [JSON.parse(raw) as ProviderFailure]
        } catch {
          return []
        }
      }),
  }
}

let shared: FailureLog | undefined

/** The tenant's log: Redis when it is set, except in tests, which read their own process. */
export function providerFailureLog(): FailureLog {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  if (env.REDIS_URL === undefined || env.NODE_ENV === "test") {
    shared = createMemoryFailureLog()
    return shared
  }
  const url = env.REDIS_URL
  let client: Redis | undefined
  shared = createRedisFailureLog(
    () => (client ??= createRedisClient(url, "failure_log")),
    `qt:if:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV)}:`
  )
  return shared
}

/** Notes a failure without holding up, or failing, the call it came from. */
export function noteProviderFailure(
  provider: string,
  failure: ProviderFailure,
  log: () => FailureLog = providerFailureLog
): void {
  if (!worthNoting(failure.status)) {
    return
  }
  void log()
    .note(provider, failure)
    .catch((error: unknown) => {
      logger.warn({ event: "http_client.failure_log_error", provider, err: errorSummary(error) })
    })
}

/** A call the client gave up on, as it prepared it: noted when the provider's error says so. */
export function noteGivenUp(
  provider: string,
  call: {
    method: string
    fields: Record<string, unknown>
    error: unknown
    status: number | null
    at: number
  },
  log?: () => FailureLog
): void {
  if (call.error instanceof ProviderError) {
    noteProviderFailure(
      provider,
      {
        at: new Date(call.at).toISOString(),
        code: call.error.providerCode,
        status: call.status,
        method: call.method,
        path: String(call.fields["path"]),
        request_id: currentRequestId() ?? null,
      },
      log
    )
  }
}
