import { kurus } from "../../money"
import { isUndercut, planListRows } from "../plan"
import type { PlanList, PlanRow, PlanVariant } from "../plan"

const LEVEL: PlanList = { kind: "level", price_list_id: "plist_level", rate_bps: 2000 }
const PRIVATE: PlanList = { kind: "private", price_list_id: "plist_own", rate_bps: null }

const variant = (id: string, vat = 2000): PlanVariant => ({
  id,
  price_set_id: `pset_${id}`,
  vat_bps: vat,
})

let next = 0
const row = (set: string, amount: number, extra: Partial<PlanRow> = {}): PlanRow => ({
  id: `price_${String((next += 1))}`,
  price_set_id: `pset_${set}`,
  price_list_id: null,
  amount: kurus(amount),
  rules_count: 0,
  tiered: false,
  ...extra,
})

describe("a wholesale list's rows planned (ADR-0068 §4)", () => {
  it("prices every variant with its own price by the rate, adding what is missing", () => {
    const plan = planListRows(
      LEVEL,
      [variant("a"), variant("b")],
      [row("a", 10_000), row("b", 3333)],
      new Map()
    )
    expect(plan.create).toEqual([
      { variant_id: "a", price_set_id: "pset_a", amount: 8000 },
      { variant_id: "b", price_set_id: "pset_b", amount: 2666 },
    ])
    expect(plan.update).toEqual([])
    expect(plan.delete).toEqual([])
  })

  it("updates a rate row whose own price moved, and leaves a right one alone", () => {
    const moved = row("a", 9000, { price_list_id: "plist_level" })
    const right = row("b", 8000, { price_list_id: "plist_level" })
    const plan = planListRows(
      LEVEL,
      [variant("a"), variant("b")],
      [row("a", 12_000), moved, row("b", 10_000), right],
      new Map()
    )
    expect(plan.update).toEqual([
      { variant_id: "a", price_set_id: "pset_a", id: moved.id, amount: 9600, before: 9000 },
    ])
    expect(plan.create).toEqual([])
    expect(plan.delete).toEqual([])
  })

  it("never lets the rate overwrite a hand-entered price: its net plus the variant's KDV", () => {
    const listed = row("a", 8000, { price_list_id: "plist_level" })
    const plan = planListRows(
      LEVEL,
      [variant("a", 1000)],
      [row("a", 10_000), listed],
      new Map([["a", kurus(5000)]])
    )
    // 50.00 net with 10% KDV is 55.00, whatever the rate says
    expect(plan.update).toEqual([
      { variant_id: "a", price_set_id: "pset_a", id: listed.id, amount: 5500, before: 8000 },
    ])
  })

  it("keeps a hand-entered price for a variant with no own price", () => {
    const plan = planListRows(LEVEL, [variant("a")], [], new Map([["a", kurus(1000)]]))
    expect(plan.create).toEqual([{ variant_id: "a", price_set_id: "pset_a", amount: 1200 }])
  })

  it("takes away a row nothing prices any more: no rate, no hand-entered price", () => {
    const stale = row("a", 8000, { price_list_id: "plist_level" })
    const plan = planListRows(
      { ...LEVEL, rate_bps: null },
      [variant("a")],
      [row("a", 10_000), stale],
      new Map()
    )
    expect(plan.delete).toEqual([{ id: stale.id, price_set_id: "pset_a", amount: 8000 }])
    expect(plan.create).toEqual([])
  })

  it("prices no variant without its own price by the rate", () => {
    const plan = planListRows(LEVEL, [variant("a")], [], new Map())
    expect(plan).toEqual({ create: [], update: [], delete: [] })
  })

  it("reads the own price outside lists, rules and quantity tiers only", () => {
    const plan = planListRows(
      LEVEL,
      [variant("a")],
      [
        row("a", 5000, { price_list_id: "plist_sale" }),
        row("a", 7000, { rules_count: 1 }),
        row("a", 6000, { tiered: true }),
        row("a", 10_000),
      ],
      new Map()
    )
    expect(plan.create).toEqual([{ variant_id: "a", price_set_id: "pset_a", amount: 8000 }])
  })

  it("replaces a private list's row without its group rule, and keeps one with it", () => {
    const bare = row("a", 9000, { price_list_id: "plist_own" })
    const ruled = row("b", 9000, { price_list_id: "plist_own", rules_count: 1 })
    const manual = new Map([
      ["a", kurus(7500)],
      ["b", kurus(7500)],
    ])
    const plan = planListRows(PRIVATE, [variant("a"), variant("b")], [bare, ruled], manual)
    expect(plan.delete).toEqual([{ id: bare.id, price_set_id: "pset_a", amount: 9000 }])
    expect(plan.create).toEqual([{ variant_id: "a", price_set_id: "pset_a", amount: 9000 }])
    expect(plan.update).toEqual([])
  })

  it("takes away a second row of the same variant on the list", () => {
    const first = row("a", 8000, { price_list_id: "plist_level" })
    const second = row("a", 7000, { price_list_id: "plist_level" })
    const plan = planListRows(LEVEL, [variant("a")], [row("a", 10_000), first, second], new Map())
    expect(plan.delete).toEqual([{ id: second.id, price_set_id: "pset_a", amount: 7000 }])
    expect(plan.update).toEqual([])
  })

  it("leaves another list's rows and quantity tiers on its own list alone", () => {
    const tier = row("a", 1000, { price_list_id: "plist_level", tiered: true })
    const other = row("a", 1000, { price_list_id: "plist_other" })
    const plan = planListRows(
      { ...LEVEL, rate_bps: null },
      [variant("a")],
      [row("a", 10_000), tier, other],
      new Map()
    )
    expect(plan).toEqual({ create: [], update: [], delete: [] })
  })
})

describe("the retail warning (Ek 2026-11-15)", () => {
  it("flags a wholesale price retail now undercuts, never one without retail", () => {
    expect(isUndercut(kurus(7000), kurus(8000))).toBe(true)
    expect(isUndercut(kurus(8000), kurus(8000))).toBe(false)
    expect(isUndercut(kurus(9000), kurus(8000))).toBe(false)
    expect(isUndercut(null, kurus(8000))).toBe(false)
  })
})
