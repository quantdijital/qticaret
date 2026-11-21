import type { Snapshot } from "./types"

/**
 * What a handler may add to its audit entry through `res.locals`
 * (adr/0011): the id of the record it made, for a route without one in
 * its path, and a small summary of what it did (counts, never personal
 * data). `mutations.ts` reads them when it writes the entry.
 */
export const AUDIT_RESOURCE_ID = "audit_resource_id"
export const AUDIT_RESULT = "audit_result"
/**
 * The registered resource's snapshots before and after, as the handler's
 * own write saw them under its lock (a settings section, #249): used for
 * the entry's diff in place of the ones read around the request, which
 * another write racing this one may have moved. Only a successful
 * handler sets it; any other answer keeps the read-around diff.
 */
export const AUDIT_CHANGE = "audit_change"

export interface AuditChange {
  before: Snapshot
  after: Snapshot
}

const isSnapshot = (value: unknown): value is Snapshot =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** The handler's `AUDIT_CHANGE`, when it is one; null otherwise. */
export function auditChangeOf(value: unknown): AuditChange | null {
  if (!isSnapshot(value)) {
    return null
  }
  const { before, after } = value
  return isSnapshot(before) && isSnapshot(after) ? { before, after } : null
}
