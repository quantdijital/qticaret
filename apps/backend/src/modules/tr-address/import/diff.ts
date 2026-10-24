/**
 * Upsert plan for one level of the address tree, matched on a natural key
 * (adr/0008). Records missing from the input are only deactivated, never
 * deleted, so stored addresses keep pointing at a valid place.
 */

export interface ExistingRecord<T> {
  id: string
  key: string
  is_active: boolean
  values: T
}

export interface DesiredRecord<T> {
  key: string
  values: T
}

export interface LevelPlan<T> {
  create: T[]
  update: (T & { id: string; is_active: true })[]
  deactivate: string[]
  unchanged: number
}

export function planLevel<T extends Record<string, string>>(
  existing: ExistingRecord<T>[],
  desired: DesiredRecord<T>[],
  options: { deactivateMissing: boolean }
): LevelPlan<T> {
  const byKey = new Map(existing.map((record) => [record.key, record]))
  const plan: LevelPlan<T> = { create: [], update: [], deactivate: [], unchanged: 0 }
  const seen = new Set<string>()

  for (const record of desired) {
    seen.add(record.key)
    const current = byKey.get(record.key)
    if (!current) {
      plan.create.push(record.values)
    } else if (!current.is_active || differs(current.values, record.values)) {
      plan.update.push({ ...record.values, id: current.id, is_active: true })
    } else {
      plan.unchanged++
    }
  }

  if (options.deactivateMissing) {
    plan.deactivate = existing
      .filter((record) => record.is_active && !seen.has(record.key))
      .map((record) => record.id)
  }
  return plan
}

function differs<T extends Record<string, string>>(current: T, next: T): boolean {
  return Object.keys(next).some((field) => current[field] !== next[field])
}
