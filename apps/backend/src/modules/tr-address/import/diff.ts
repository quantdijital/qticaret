/**
 * Upsert plan for one level of the address tree (adr/0008). A record is
 * matched by the source's own id when both sides have one (a renamed or
 * moved place stays the same record), otherwise by its natural key. A
 * record whose source id another input record carries is never taken by
 * key. Records missing from the input are only deactivated, never
 * deleted, so stored addresses keep pointing at a valid place.
 */

export type PlanValues = Record<string, string | null>

export interface ExistingRecord<T> {
  id: string
  key: string
  externalId?: string | null
  is_active: boolean
  values: T
}

export interface DesiredRecord<T> {
  key: string
  externalId?: string | undefined
  /** Fields left out (a file has no source ids) are kept as stored. */
  values: T
}

export interface LevelPlan<T> {
  create: T[]
  update: (T & { id: string; is_active: true })[]
  /**
   * Active records whose key changes: parked inactive before the updates,
   * so two records never hold one key at once (the unique index covers
   * active records only), however the renames chain.
   */
  rekey: string[]
  deactivate: string[]
  unchanged: number
}

export function planLevel<T extends PlanValues>(
  existing: ExistingRecord<T>[],
  desired: DesiredRecord<T>[],
  options: { shouldDeactivateMissing: boolean }
): LevelPlan<T> {
  const byExternal = new Map<string, ExistingRecord<T>>()
  const byKey = new Map<string, ExistingRecord<T>[]>()
  for (const record of existing) {
    if (record.externalId) {
      byExternal.set(record.externalId, record)
    }
    byKey.set(record.key, [...(byKey.get(record.key) ?? []), record])
  }
  // Under one key, the active record is taken before inactive ones
  for (const records of byKey.values()) {
    records.sort((a, b) => Number(b.is_active) - Number(a.is_active))
  }
  const wanted = new Set(desired.flatMap((record) => record.externalId ?? []))
  const claimed = new Set<string>()
  const adoptable = (record: ExistingRecord<T>) =>
    !claimed.has(record.id) && !(record.externalId && wanted.has(record.externalId))

  const plan: LevelPlan<T> = { create: [], update: [], rekey: [], deactivate: [], unchanged: 0 }
  for (const record of desired) {
    const own = record.externalId ? byExternal.get(record.externalId) : undefined
    const current = own && !claimed.has(own.id) ? own : byKey.get(record.key)?.find(adoptable)
    if (!current) {
      plan.create.push(record.values)
      continue
    }
    claimed.add(current.id)
    if (current.is_active && !differs(current.values, record.values)) {
      plan.unchanged++
      continue
    }
    plan.update.push({ ...record.values, id: current.id, is_active: true })
    if (current.is_active && current.key !== record.key) {
      plan.rekey.push(current.id)
    }
  }

  if (options.shouldDeactivateMissing) {
    plan.deactivate = existing
      .filter((record) => record.is_active && !claimed.has(record.id))
      .map((record) => record.id)
  }
  return plan
}

function differs<T extends PlanValues>(current: T, next: T): boolean {
  return Object.keys(next).some((field) => (current[field] ?? null) !== (next[field] ?? null))
}
