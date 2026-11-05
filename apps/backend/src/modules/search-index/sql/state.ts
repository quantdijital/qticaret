import type { Executor } from "../types"

/**
 * What the index's upkeep compared last (adr/0056, adr/0023 Ek 2026-11-05):
 * a value by key, shared by the tenant's processes, so a change no event
 * tells of (an automatic promotion's) is noticed once, whichever process
 * runs the minute job.
 */

export async function readState(db: Executor, key: string): Promise<string | null> {
  const [row] = (await db.execute(`SELECT value FROM search_index_state WHERE key = ?`, [key])) as {
    value: string
  }[]
  return row?.value ?? null
}

export async function writeState(db: Executor, key: string, value: string): Promise<void> {
  await db.execute(
    `INSERT INTO search_index_state (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  )
}
