import { RuleType } from "@medusajs/framework/utils"
import { planOffer } from "../offer-plan"
import type { OfferState, UpdateOfferInput } from "../offer-plan"

const STATE: OfferState = {
  target_rule_ids: ["prule_t1"],
  buy_rule_ids: ["prule_b1"],
  minimum_rule_ids: ["prule_m1"],
  campaign_id: "procamp_1",
  owns_campaign: true,
  per_customer_budget: true,
  has_budget: true,
}

const INPUT: UpdateOfferInput = {
  id: "promo_1",
  promotion: { code: "YAZ10", is_automatic: false, limit: null },
}

const rule = (attribute: string, values: string[]) => ({
  attribute,
  operator: "in" as const,
  values,
})

describe("planOffer (F4.4/F4.5)", () => {
  it("changes only the promotion's own fields when nothing else changed", () => {
    const plan = planOffer(INPUT, STATE)
    expect(plan.fields).toEqual({ promotionsData: [{ id: "promo_1", ...INPUT.promotion }] })
    expect(plan).toMatchObject({
      itemRules: null,
      targetType: null,
      basketRules: null,
      buyRules: null,
      minimum: null,
      campaign: null,
      newCampaign: null,
    })
  })

  it("aims at items after their rules, and drops them after the whole basket is aimed at", () => {
    const items = planOffer(
      {
        ...INPUT,
        scope: {
          target_type: "items",
          target_rules: [rule("items.product.id", ["prod_1"])],
          buy_rules: [rule("items.product.id", ["prod_1"])],
        },
      },
      STATE
    )
    expect(items.itemRules).toMatchObject({
      rule_type: RuleType.TARGET_RULES,
      create: [rule("items.product.id", ["prod_1"])],
      delete: ["prule_t1"],
    })
    expect(items.buyRules).toMatchObject({ rule_type: RuleType.BUY_RULES, delete: ["prule_b1"] })
    expect(items.basketRules).toBeNull()
    const basket = planOffer({ ...INPUT, scope: { target_type: "order", target_rules: [] } }, STATE)
    expect(basket.itemRules).toBeNull()
    expect(basket.targetType).toEqual({
      promotionsData: [{ id: "promo_1", application_method: { target_type: "order" } }],
    })
    expect(basket.basketRules).toMatchObject({ create: [], delete: ["prule_t1"] })
  })

  it("replaces the basket minimum's own rules only", () => {
    const plan = planOffer(
      { ...INPUT, minimum: [{ attribute: "item_total", operator: "gte", values: ["250"] }] },
      STATE
    )
    expect(plan.minimum).toMatchObject({ rule_type: RuleType.RULES, delete: ["prule_m1"] })
  })

  it("changes a campaign of its own, never a shared one or a budget of another kind", () => {
    const change = {
      ...INPUT,
      per_customer: { limit: 2 },
      dates: { starts_at: null, ends_at: "2026-12-31T20:59:59.000Z" },
    }
    expect(planOffer(change, STATE).campaign).toEqual({
      id: "procamp_1",
      budget: { limit: 2 },
      starts_at: null,
      ends_at: new Date("2026-12-31T20:59:59.000Z"),
    })
    expect(planOffer(change, { ...STATE, owns_campaign: false }).campaign).toBeNull()
    expect(planOffer(change, { ...STATE, per_customer_budget: false }).campaign).toEqual({
      id: "procamp_1",
      starts_at: null,
      ends_at: new Date("2026-12-31T20:59:59.000Z"),
    })
  })

  it("makes a campaign only when one is needed and there is none", () => {
    const loose: OfferState = {
      ...STATE,
      campaign_id: null,
      has_budget: false,
      per_customer_budget: false,
    }
    const campaign = {
      name: "YAZ10",
      campaign_identifier: "yaz10-1",
      starts_at: "2026-06-01T00:00:00.000+03:00",
      ends_at: null,
      budget: { type: "use_by_attribute" as const, attribute: "customer_id", limit: 1 },
    }
    expect(
      planOffer({ ...INPUT, per_customer: { limit: 1 }, campaign }, loose).newCampaign
    ).toEqual({
      ...campaign,
      starts_at: new Date("2026-06-01T00:00:00.000+03:00"),
      ends_at: null,
    })
    expect(
      planOffer({ ...INPUT, per_customer: { limit: null }, campaign }, loose).newCampaign
    ).toBeNull()
  })
})
