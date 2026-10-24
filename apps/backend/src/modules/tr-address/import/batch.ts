import type { LevelPlan } from "./diff"

const BATCH_SIZE = 1000

export interface LevelSummary {
  created: number
  updated: number
  deactivated: number
  unchanged: number
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
