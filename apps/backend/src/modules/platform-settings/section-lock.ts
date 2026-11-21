import type { Context } from "@medusajs/framework/types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** The advisory lock key of one settings section (one row, `section` unique). */
export const sectionLockKey = (name: string): string => `settings_section:${name}`

/**
 * Holds the section's advisory lock until the surrounding transaction ends
 * (PR #248 review L2). A save reads the row, merges the patch over it and
 * writes it back; without the lock two saves racing both merge over the
 * same old row and the later write drops the other's fields. A row lock
 * (`FOR UPDATE`) would not cover a section's first save, when there is no
 * row yet to lock; the advisory lock is taken whether the row exists or
 * not, as the platform flags' sync does (service-platform-flags.ts). Must
 * run inside a transaction, before the row is read.
 */
export async function lockSection(sharedContext: Context, name: string): Promise<void> {
  const manager = sharedContext.transactionManager as Executor | undefined
  if (!manager) {
    throw new Error("platform_settings.lock_outside_transaction")
  }
  await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [sectionLockKey(name)])
}
