import type { Snapshot } from "./types"

export interface FieldChange {
  before?: unknown
  after?: unknown
  /** Sensitive fields: whether it changed and the last 4 characters it ended with. */
  changed?: true
  after_last4?: string | null
}

const last4 = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value).replace(/"/g, "").slice(-4)

/** Field-by-field differences between two snapshots; unchanged fields are left out. */
export function diffSnapshots(
  before: Snapshot,
  after: Snapshot,
  sensitive: readonly string[] = []
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[key]
    const is = after[key]
    if (JSON.stringify(was) === JSON.stringify(is)) {
      continue
    }
    changes[key] = sensitive.includes(key)
      ? { changed: true, after_last4: last4(is) }
      : {
          ...(was === undefined ? {} : { before: was }),
          ...(is === undefined ? {} : { after: is }),
        }
  }
  return changes
}
