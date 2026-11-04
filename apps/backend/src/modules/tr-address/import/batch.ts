import type { LevelPlan } from "./diff"

const BATCH_SIZE = 1000

export interface LevelSummary {
  created: number
  updated: number
  deactivated: number
  unchanged: number
}

export interface LevelWriter<T> {
  create: (data: T[]) => Promise<unknown>
  update: (data: object[]) => Promise<unknown>
}

export function chunk<T>(items: T[]): T[][] {
  const batches: T[][] = []
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    batches.push(items.slice(start, start + BATCH_SIZE))
  }
  return batches
}

export function summarize(plan: LevelPlan<unknown>): LevelSummary {
  return {
    created: plan.create.length,
    updated: plan.update.length,
    deactivated: plan.deactivate.length,
    unchanged: plan.unchanged,
  }
}

export function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("tr-address import: parent record missing after upsert")
  }
  return value
}

const inactive = (ids: string[]) => ids.map((id) => ({ id, is_active: false }))

/**
 * Writes a level's plan in an order the unique index (one active record
 * per key) never sees broken: places gone first, then renamed ones parked
 * inactive, then every update, then the new places. One transaction holds
 * it all, so nobody reads the parked state.
 */
export async function applyPlan<T>(plan: LevelPlan<T>, write: LevelWriter<T>): Promise<void> {
  for (const batch of chunk(plan.deactivate)) {
    await write.update(inactive(batch))
  }
  for (const batch of chunk(plan.rekey)) {
    await write.update(inactive(batch))
  }
  for (const batch of chunk(plan.update)) {
    await write.update(batch)
  }
  for (const batch of chunk(plan.create)) {
    await write.create(batch)
  }
}
