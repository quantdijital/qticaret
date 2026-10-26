import { formatMoneyInput } from "@/lib/money-input"

/**
 * Where a promotion applies and when (F4.4, ADR-0024), as Medusa's rules:
 * the items it discounts (target rules on categories, collections or
 * products), the least the basket must hold (`item_total gte`, tax
 * included, after discounts) and how often one customer may use it (a
 * campaign budget counted per `customer_id`).
 */

export type Scope = "all" | "categories" | "collections" | "products"

const ATTRIBUTES: Readonly<Record<Exclude<Scope, "all">, string>> = {
  categories: "items.product.categories.id",
  collections: "items.product.collection_id",
  products: "items.product.id",
}
export const MINIMUM_ATTRIBUTE = "item_total"
export const PER_CUSTOMER_ATTRIBUTE = "customer_id"

export interface RuleLike {
  id?: string | null
  attribute?: string | null
  operator?: string | null
  values?: ({ value?: string | null } | null)[] | null
}

export interface RuleInput {
  attribute: string
  operator: "in" | "gte"
  values: string[]
}

const valuesOf = (rule: RuleLike): string[] =>
  (rule.values ?? []).flatMap((each) => (each?.value ? [each.value] : []))

/** The scope a promotion's target rules give; one it does not know reads as the whole basket. */
export function scopeOf(targetRules: readonly (RuleLike | null)[] | null | undefined): {
  scope: Scope
  ids: string[]
} {
  for (const rule of targetRules ?? []) {
    const scope = (Object.keys(ATTRIBUTES) as Exclude<Scope, "all">[]).find(
      (key) => ATTRIBUTES[key] === rule?.attribute
    )
    if (scope && rule) {
      return { scope, ids: valuesOf(rule) }
    }
  }
  return { scope: "all", ids: [] }
}

export function targetRulesFor(scope: Scope, ids: readonly string[]): RuleInput[] {
  return scope === "all" ? [] : [{ attribute: ATTRIBUTES[scope], operator: "in", values: [...ids] }]
}

/** The least basket a promotion's rules ask for, as the form shows it ("150,00"); empty for none. */
export function minimumOf(rules: readonly (RuleLike | null)[] | null | undefined): string {
  const rule = (rules ?? []).find((each) => each?.attribute === MINIMUM_ATTRIBUTE)
  const amount = rule ? Number(valuesOf(rule)[0]) : Number.NaN
  return Number.isFinite(amount) && amount > 0 ? formatMoneyInput(amount) : ""
}

export function minimumRulesFor(minimum: number | null): RuleInput[] {
  return minimum && minimum > 0
    ? [{ attribute: MINIMUM_ATTRIBUTE, operator: "gte", values: [String(minimum)] }]
    : []
}

/** The rules of a promotion that are the minimum's: replaced when it changes. */
export const minimumRuleIds = (rules: readonly (RuleLike | null)[] | null | undefined): string[] =>
  (rules ?? []).flatMap((rule) =>
    rule?.id && rule.attribute === MINIMUM_ATTRIBUTE ? [rule.id] : []
  )

export interface BudgetLike {
  type?: string | null
  attribute?: string | null
  limit?: number | null
}

/** A budget counted per customer: the only kind the form writes. */
export const isPerCustomerBudget = (budget: BudgetLike | null | undefined): boolean =>
  budget?.type === "use_by_attribute" && budget.attribute === PER_CUSTOMER_ATTRIBUTE

/** How often one customer may use it, as the form shows it; empty when not limited so. */
export function perCustomerOf(budget: BudgetLike | null | undefined): string {
  return isPerCustomerBudget(budget) && budget?.limit ? String(budget.limit) : ""
}

export const perCustomerBudget = (limit: number) => ({
  type: "use_by_attribute" as const,
  attribute: PER_CUSTOMER_ATTRIBUTE,
  limit,
})
