import { describe, expect, it } from "vitest"
import { buyGetCounts, createBody, promotionSchema, valuesOf } from "./form"

const base = { ...valuesOf(null), code: "yaz10", value: "10" }

describe("promotion form", () => {
  it("checks the value for the kind and the date order", () => {
    expect(promotionSchema.safeParse({ ...base, value: "150" }).success).toBe(false)
    expect(promotionSchema.safeParse({ ...base, kind: "fixed", value: "0" }).success).toBe(false)
    expect(promotionSchema.safeParse({ ...base, kind: "free_shipping", value: "" }).success).toBe(
      true
    )
    expect(
      promotionSchema.safeParse({ ...base, starts: "2026-11-02", ends: "2026-11-01" }).success
    ).toBe(false)
  })

  it("takes no limit, or one above zero", () => {
    for (const [field, value, ok] of [
      ["limit", "", true],
      ["limit", "25", true],
      ["limit", "0", false],
      ["limit", "007", false],
      ["perCustomer", "", true],
      ["perCustomer", "2", true],
      ["perCustomer", "0", false],
    ] as const) {
      expect(promotionSchema.safeParse({ ...base, [field]: value }).success).toBe(ok)
    }
  })

  it("upper-cases the code, drops the limit of an automatic one, dates a campaign", () => {
    const body = createBody(
      { ...base, automatic: true, limit: "50", starts: "2026-11-01", ends: "" },
      "try",
      "t1"
    )

    expect(body.code).toBe("YAZ10")
    expect(body.limit).toBeNull()
    expect(body.campaign).toEqual({
      name: "YAZ10",
      campaign_identifier: "YAZ10-T1",
      starts_at: new Date("2026-11-01T00:00:00+03:00"),
      ends_at: null,
    })
  })

  it("reads a stored promotion's day back in Turkish time", () => {
    const values = valuesOf({
      code: "X",
      campaign: { starts_at: "2026-10-31T21:00:00.000Z", ends_at: null },
      application_method: { type: "fixed", target_type: "order", value: 49.9 },
    } as never)

    expect(values.starts).toBe("2026-11-01")
    expect(values.value).toBe("49,9")
  })

  it("aims at the chosen items, a basket minimum and a per-customer budget", () => {
    const body = createBody(
      {
        ...base,
        scope: "categories",
        scopeIds: ["pcat_1"],
        minimum: "150",
        perCustomer: "1",
      },
      "try",
      "t2"
    )
    expect(body.application_method).toMatchObject({
      target_type: "items",
      allocation: "across",
      target_rules: [
        { attribute: "items.product.categories.id", operator: "in", values: ["pcat_1"] },
      ],
    })
    expect(body.rules).toEqual([{ attribute: "item_total", operator: "gte", values: ["150"] }])
    expect(body.campaign?.budget).toEqual({
      type: "use_by_attribute",
      attribute: "customer_id",
      limit: 1,
    })
    expect(promotionSchema.safeParse({ ...base, scope: "products", scopeIds: [] }).success).toBe(
      false
    )
    expect(promotionSchema.safeParse({ ...base, minimum: "0" }).success).toBe(false)
  })

  it("reads a stored promotion's scope, minimum and per-customer limit back", () => {
    const values = valuesOf({
      code: "X",
      rules: [{ id: "r1", attribute: "item_total", values: [{ value: "200" }] }],
      application_method: {
        type: "percentage",
        target_type: "items",
        value: 10,
        target_rules: [{ id: "t1", attribute: "items.product.id", values: [{ value: "prod_1" }] }],
      },
      campaign: { budget: { type: "use_by_attribute", attribute: "customer_id", limit: 3 } },
    } as never)
    expect(values).toMatchObject({
      scope: "products",
      scopeIds: ["prod_1"],
      minimum: "200,00",
      perCustomer: "3",
    })
  })

  it("takes buy X, pay Y with fewer paid than taken, on chosen products", () => {
    const buyget = {
      ...base,
      kind: "buyget" as const,
      value: "",
      scope: "products" as const,
      scopeIds: ["prod_1"],
    }
    const errors = (values: typeof buyget) => {
      const parsed = promotionSchema.safeParse(values)
      return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
    }
    expect(errors(buyget)).toEqual([])
    expect(errors({ ...buyget, buyCount: "2", payCount: "2" })).toEqual([
      "promotions.errors.buyget",
    ])
    expect(errors({ ...buyget, buyCount: "100", payCount: "2" })).toEqual([
      "promotions.errors.buyget",
    ])
    expect(errors({ ...buyget, scope: "all" as never, scopeIds: [] })).toEqual([
      "promotions.errors.buygetScope",
    ])

    const body = createBody(buyget, "try")
    expect(body.type).toBe("buyget")
    expect(body.application_method).toMatchObject({
      apply_to_quantity: 1,
      buy_rules_min_quantity: 2,
      target_type: "items",
    })
    expect(buyGetCounts({ buyCount: "3", payCount: "2" })).toEqual({ buy: 3, pay: 2 })
  })
})
