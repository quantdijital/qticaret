import { describe, expect, it } from "vitest"
import {
  audienceOf,
  audienceRulesFor,
  isAudienceRule,
  isPerCustomerBudget,
  sameAudience,
  minimumOf,
  minimumRuleIds,
  minimumRulesFor,
  perCustomerOf,
  scopeOf,
  targetRulesFor,
} from "./scope"

const rule = (id: string, attribute: string, values: string[]) => ({
  id,
  attribute,
  operator: "in",
  values: values.map((value) => ({ value })),
})

describe("promotion scope and conditions (ADR-0024)", () => {
  it("reads and writes the items a promotion applies to", () => {
    expect(scopeOf([rule("r1", "items.product.categories.id", ["pcat_1", "pcat_2"])])).toEqual({
      scope: "categories",
      ids: ["pcat_1", "pcat_2"],
    })
    expect(scopeOf([rule("r1", "items.product.collection_id", ["pcol_1"])]).scope).toBe(
      "collections"
    )
    expect(scopeOf([rule("r1", "items.product.type_id", ["ptyp_1"])])).toEqual({
      scope: "all",
      ids: [],
    })
    expect(scopeOf(null)).toEqual({ scope: "all", ids: [] })
    expect(targetRulesFor("products", ["prod_1"])).toEqual([
      { attribute: "items.product.id", operator: "in", values: ["prod_1"] },
    ])
    expect(targetRulesFor("all", ["prod_1"])).toEqual([])
  })

  it("reads and writes the least basket, tax included", () => {
    const rules = [rule("r1", "item_total", ["150"]), rule("r2", "customer.groups.id", ["g1"])]
    expect(minimumOf(rules)).toBe("150,00")
    expect(minimumRuleIds(rules)).toEqual(["r1"])
    expect(minimumOf([])).toBe("")
    expect(minimumRulesFor(99.9)).toEqual([
      { attribute: "item_total", operator: "gte", values: ["99.9"] },
    ])
    expect(minimumRulesFor(null)).toEqual([])
  })

  it("reads a per-customer limit from its own kind of budget only", () => {
    const own = { type: "use_by_attribute", attribute: "customer_id", limit: 2 }
    expect(perCustomerOf(own)).toBe("2")
    expect(isPerCustomerBudget(own)).toBe(true)
    expect(perCustomerOf({ type: "usage", limit: 100 })).toBe("")
    expect(isPerCustomerBudget({ type: "spend", limit: 1000 })).toBe(false)
    expect(perCustomerOf(null)).toBe("")
  })

  it("reads and writes who may use it (K1/K2)", () => {
    const rules = [
      rule("r1", "item_total", ["150"]),
      rule("r2", "customer.groups.id", ["g1", "g2"]),
      rule("r3", "first_order", ["true"]),
    ]
    const read = audienceOf(rules)
    expect(read).toEqual({ audience: "groups", groups: ["g1", "g2"], firstOrder: true })
    expect(audienceRulesFor(read)).toEqual([
      { attribute: "customer.groups.id", operator: "in", values: ["g1", "g2"] },
      { attribute: "first_order", operator: "in", values: ["true"] },
    ])
    expect(audienceOf([])).toEqual({ audience: "everyone", groups: [], firstOrder: false })
    // Groups picked, then everyone chosen: no group rule
    expect(audienceRulesFor({ audience: "everyone", groups: ["g1"], firstOrder: false })).toEqual(
      []
    )
    expect(isAudienceRule({ attribute: "item_total" })).toBe(false)
    expect(sameAudience(read, { audience: "groups", groups: ["g2", "g1"], firstOrder: true })).toBe(
      true
    )
    expect(sameAudience(read, { ...read, firstOrder: false })).toBe(false)
  })
})
