import type { Context } from "@medusajs/framework/types"
import { RetryableError } from "../../lib/errors"

interface Executor {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>
}

/** The advisory lock key of one settings section (one row, `section` unique). */
export const sectionLockKey = (name: string): string => `settings_section:${name}`

// How long a save waits for another save of the same section; the client
// is told to try again after LOCK_RETRY_AFTER_MS (as `lockTimeoutError`)
const LOCK_TIMEOUT_SQL = "SET LOCAL lock_timeout = '5s'"
const LOCK_RETRY_AFTER_MS = 2_000
// Postgres `lock_not_available`: the wait ran past lock_timeout
const LOCK_NOT_AVAILABLE = "55P03"

const isLockTimeout = (error: unknown): boolean => {
  const fields = error as { code?: unknown; message?: unknown } | null
  return (
    fields?.code === LOCK_NOT_AVAILABLE ||
    (typeof fields?.message === "string" && fields.message.includes("lock timeout"))
  )
}

/**
 * Holds the section's advisory lock until the surrounding transaction ends
 * (PR #248 review L2). A save reads the row, merges the patch over it and
 * writes it back; without the lock two saves racing both merge over the
 * same old row and the later write drops the other's fields. A row lock
 * (`FOR UPDATE`) would not cover a section's first save, when there is no
 * row yet to lock; the advisory lock is taken whether the row exists or
 * not, as the platform flags' sync does (service-platform-flags.ts). Must
 * run inside a transaction, before the row is read. A wait past 5 s (a
 * stuck transaction) ends as a RetryableError (503, Retry-After), not a
 * request hanging on the pool.
 */
export async function lockSection(sharedContext: Context, name: string): Promise<void> {
  const manager = sharedContext.transactionManager as Executor | undefined
  if (!manager) {
    throw new Error("platform_settings.lock_outside_transaction")
  }
  // LOCAL: the timeout ends with this transaction, the pooled connection keeps its own
  await manager.execute(LOCK_TIMEOUT_SQL)
  try {
    await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [sectionLockKey(name)])
  } catch (error) {
    if (isLockTimeout(error)) {
      throw new RetryableError("errors.busy", { retryAfterMs: LOCK_RETRY_AFTER_MS, cause: error })
    }
    throw error
  }
}
