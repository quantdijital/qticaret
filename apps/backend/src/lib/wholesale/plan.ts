import type { Kurus } from "../money"
import { grossOfNet, ratePrice } from "./money"

/**
 * What a wholesale list's rows should be for some variants (ADR-0068 §4,
 * Ek 2026-11-15), against what they are. A price entered by hand wins
 * over the rate and is never touched by it; the rate prices every variant
 * with a price of its own; a variant neither prices has no row. A private
 * list's rows carry their group as a price rule (one rule on the row), a
 * level's carry none: a row of the wrong shape is replaced.
 */

export interface PlanList {
  kind: "level" | "private"
  price_list_id: string
  rate_bps: number | null
}

export interface PlanVariant {
  id: string
  price_set_id: string
  /** The variant's KDV rate in basis points (2000 = 20%). */
  vat_bps: number
}

/** A price row of these variants' sets, in the shop's currency, as read. */
export interface PlanRow {
  id: string
  price_set_id: string
  price_list_id: string | null
  amount: Kurus
  rules_count: number
  /** A quantity tier (min or max quantity): never a list's plain row, never the base. */
  tiered: boolean
}

export interface ListRowWrite {
  variant_id: string
  price_set_id: string
  /** KDV included. */
  amount: Kurus
}

/** A row as it stands: what an update or a delete gives back if undone. */
export interface ListRowBefore {
  id: string
  price_set_id: string
  amount: Kurus
}

export interface ListPlan {
  create: ListRowWrite[]
  update: (ListRowWrite & { id: string; before: Kurus })[]
  delete: ListRowBefore[]
}

const before = (row: PlanRow): ListRowBefore => ({
  id: row.id,
  price_set_id: row.price_set_id,
  amount: row.amount,
})

const ruleCountOf = (kind: PlanList["kind"]): number => (kind === "private" ? 1 : 0)

/** The price this variant should have on the list, KDV included; null: no row. */
export function desiredPrice(
  list: PlanList,
  variant: PlanVariant,
  base: Kurus | null,
  manualNet: Kurus | undefined
): Kurus | null {
  if (manualNet !== undefined) {
    return grossOfNet(manualNet, variant.vat_bps)
  }
  if (list.rate_bps !== null && base !== null && !rateGivesNothing(base, list.rate_bps)) {
    return ratePrice(base, list.rate_bps)
  }
  return null
}

/**
 * A rate that leaves a priced variant at 0,00 (a few kuruş less 99%):
 * no row is written, so the variant keeps its retail price rather than
 * going free; the lines screen names these.
 */
export const rateGivesNothing = (base: Kurus, rateBps: number): boolean =>
  base > 0 && ratePrice(base, rateBps) === 0

/** A variant's own price: outside every list, for anyone, any quantity. */
export const baseOf = (rows: readonly PlanRow[]): Kurus | null =>
  rows.find((row) => row.price_list_id === null && row.rules_count === 0 && !row.tiered)?.amount ??
  null

export function planListRows(
  list: PlanList,
  variants: readonly PlanVariant[],
  rows: readonly PlanRow[],
  manual: ReadonlyMap<string, Kurus>
): ListPlan {
  const plan: ListPlan = { create: [], update: [], delete: [] }
  const bySet = new Map<string, PlanRow[]>()
  for (const row of rows) {
    bySet.set(row.price_set_id, [...(bySet.get(row.price_set_id) ?? []), row])
  }
  const rules = ruleCountOf(list.kind)
  for (const variant of variants) {
    const ofSet = bySet.get(variant.price_set_id) ?? []
    const own = ofSet.filter((row) => row.price_list_id === list.price_list_id && !row.tiered)
    const keep = own.find((row) => row.rules_count === rules)
    plan.delete.push(...own.filter((row) => row !== keep).map(before))
    const price = desiredPrice(list, variant, baseOf(ofSet), manual.get(variant.id))
    const write = { variant_id: variant.id, price_set_id: variant.price_set_id }
    if (price === null) {
      if (keep) {
        plan.delete.push(before(keep))
      }
    } else if (!keep) {
      plan.create.push({ ...write, amount: price })
    } else if (keep.amount !== price) {
      plan.update.push({ ...write, id: keep.id, amount: price, before: keep.amount })
    }
  }
  return plan
}

export const isEmptyPlan = (plan: ListPlan): boolean =>
  plan.create.length + plan.update.length + plan.delete.length === 0

/**
 * The panel's warning, never a block (Ek 2026-11-15): the price a shopper
 * with no group pays now (a live public sale included) is below the
 * wholesale price, which the wholesaler still pays.
 */
export const isUndercut = (retailNow: Kurus | null, wholesale: Kurus): boolean =>
  retailNow !== null && retailNow < wholesale
