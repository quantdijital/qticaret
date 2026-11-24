import { randomUUID } from "node:crypto"
import type Redis from "ioredis"
import { errorSummary, logger } from "../logging"
import { registerProcessCache } from "./process-caches"

/**
 * A value held in process and reloaded when a shared version marker changes
 * (adr/0012). A write sets a new marker; every process checks it at most
 * once per `checkEveryMs` and reloads when it changed, and reloads anyway
 * after `maxAgeMs`, so nothing outlives that bound: not a lost marker write,
 * not a Redis restart, not a change made outside the service. Without a
 * marker (dev and test: one process) the writer's own invalidate is enough.
 * When the marker cannot be read the value is reloaded: the database is the
 * truth, the marker only saves reads.
 */

export interface VersionSource {
  current: () => Promise<string | null>
  bump: () => Promise<void>
}

/**
 * A marker in Redis. Each write stores a fresh random value, not a count: a
 * counter reset by a Redis restart could come back to a number a process
 * already holds. The client is created on first use, so processes that
 * never read the value (migrations, scripts) open no connection.
 */
export function createRedisVersionSource(client: () => Redis, key: string): VersionSource {
  return {
    current: () => client().get(key),
    bump: async () => {
      await client().set(key, randomUUID())
    },
  }
}

export interface VersionedCache<T> {
  get: () => Promise<T>
  /** After a write: sets a new shared marker and drops this process's value. */
  invalidate: () => Promise<void>
}

export interface VersionedCacheOptions<T> {
  load: () => Promise<T>
  source: VersionSource | null
  name: string
  checkEveryMs?: number
  maxAgeMs?: number
  now?: () => number
}

const LOG_EVERY_MS = 60_000

export function createVersionedCache<T>({
  load,
  source,
  name,
  checkEveryMs = 1_000,
  maxAgeMs = 30_000,
  now = Date.now,
}: VersionedCacheOptions<T>): VersionedCache<T> {
  let value: { data: T; version: string | null; loadedAt: number } | undefined
  let checkedAt = Number.NEGATIVE_INFINITY
  // Bumped by invalidate: a load that started before it is not kept
  let generation = 0
  let inFlight: Promise<T> | undefined
  let bumpPending = false
  let lastWarning = Number.NEGATIVE_INFINITY

  const warn = (event: string, error: unknown) => {
    if (now() - lastWarning >= LOG_EVERY_MS) {
      lastWarning = now()
      logger.warn({ event: `${name}.${event}`, err: errorSummary(error) })
    }
  }

  async function bump(): Promise<void> {
    if (!source) {
      bumpPending = false
      return
    }
    try {
      await source.bump()
      bumpPending = false
    } catch (error) {
      // Tried again on the next read; other processes catch up by maxAgeMs
      warn("version_bump_failed", error)
    }
  }

  async function currentVersion(): Promise<string | null | undefined> {
    try {
      return source ? await source.current() : null
    } catch (error) {
      warn("version_read_failed", error)
      return undefined
    }
  }

  const isFresh = () => value !== undefined && now() - value.loadedAt < maxAgeMs

  async function refresh(): Promise<T> {
    checkedAt = now()
    if (bumpPending) {
      await bump()
    }
    const startedIn = generation
    const version = await currentVersion()
    // undefined: the marker could not be read, so the value is reloaded
    if (value && isFresh() && version !== undefined && version === value.version) {
      return value.data
    }
    const data = await load()
    if (startedIn === generation) {
      value = { data, version: version ?? null, loadedAt: now() }
    }
    return data
  }

  const cache: VersionedCache<T> = {
    get: () => {
      if (value && isFresh() && now() - checkedAt < checkEveryMs) {
        return Promise.resolve(value.data)
      }
      // Concurrent reads share one check and one load; a refresh clears only
      // itself, not one started after an invalidate
      if (!inFlight) {
        const pending: Promise<T> = refresh().finally(() => {
          if (inFlight === pending) {
            inFlight = undefined
          }
        })
        inFlight = pending
      }
      return inFlight
    },
    invalidate: async () => {
      generation += 1
      value = undefined
      inFlight = undefined
      bumpPending = true
      await bump()
    },
  }
  // This process's copy only: the shared marker is not bumped, and a bump
  // still owed by the previous file's failed write is dropped with it
  registerProcessCache(() => {
    generation += 1
    value = undefined
    inFlight = undefined
    bumpPending = false
  }, cache)
  return cache
}
