import type { Context } from "@medusajs/framework/types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * The versions of `owner`/`name` below `below` (all without it) retired
 * inside the caller's transaction: sealed form emptied, row soft-deleted,
 * number kept (the unique index covers retired rows, and the next version
 * counts them, so a number is never reused). How many were held.
 */
export async function retire(
  sharedContext: Context,
  owner: string,
  name: string,
  below?: number
): Promise<number> {
  const rows = (await (sharedContext.transactionManager as Executor).execute(
    `UPDATE secret_record SET sealed = '', deleted_at = now(), updated_at = now()
      WHERE owner = ? AND name = ? AND deleted_at IS NULL
        ${below === undefined ? "" : "AND version < ?"} RETURNING id`,
    below === undefined ? [owner, name] : [owner, name, below]
  )) as unknown[]
  return rows.length
}
