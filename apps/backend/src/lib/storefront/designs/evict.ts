/** An automatic save as the eviction reads it. */
export interface EvictableDesign {
  id: string
  created_at: Date | string
}

const time = (value: Date | string): number => new Date(value).getTime()

/**
 * The automatic saves beyond `limit`, oldest first (adr/0064 Ek 2026-11-17
 * §1): the oldest by `created_at`, a tie by `id`. Named ones never reach here.
 */
export function autoToEvict<T extends EvictableDesign>(rows: readonly T[], limit: number): T[] {
  const excess = rows.length - limit
  if (excess <= 0) {
    return []
  }
  const ordered = [...rows].sort(
    (a, b) => time(a.created_at) - time(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  return ordered.slice(0, excess)
}
