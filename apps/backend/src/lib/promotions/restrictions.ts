/**
 * Who may use a promotion (K1/K2): Medusa promotion rules the panel's form
 * writes beside the basket minimum. Customer groups are Medusa's own rule
 * (`customer.groups.id`, read from the cart's customer on every refresh);
 * "first order only" is a rule on a fact Medusa does not have, which the
 * cart's promotion context gives it (`hooks/cart-promotion-context.ts`).
 */

export const CUSTOMER_GROUPS_ATTRIBUTE = "customer.groups.id"
/** A top-level context key: `customer.*` would replace the cart's customer and its groups. */
export const FIRST_ORDER_ATTRIBUTE = "first_order"
export const FIRST_ORDER_VALUE = "true"

/** The rules of a promotion that say who may use it: replaced together when the form saves. */
export const AUDIENCE_ATTRIBUTES: readonly string[] = [
  CUSTOMER_GROUPS_ATTRIBUTE,
  FIRST_ORDER_ATTRIBUTE,
]

export interface RestrictionRule {
  attribute?: string | null
  values?: ({ value?: string | null } | null)[] | null
}

export interface Restrictions {
  /** The customer groups it is for; null when it is for everyone. */
  groups: string[] | null
  firstOrder: boolean
}

const valuesOf = (rule: RestrictionRule): string[] =>
  (rule.values ?? []).flatMap((each) => (each?.value ? [each.value] : []))

/** What a promotion's rules restrict, read the way Medusa evaluates them. */
export function restrictionsOf(
  rules: readonly (RestrictionRule | null)[] | null | undefined
): Restrictions {
  let groups: string[] | null = null
  let firstOrder = false
  for (const rule of rules ?? []) {
    if (rule?.attribute === CUSTOMER_GROUPS_ATTRIBUTE) {
      groups = [...(groups ?? []), ...valuesOf(rule)]
    }
    if (rule?.attribute === FIRST_ORDER_ATTRIBUTE && valuesOf(rule).includes(FIRST_ORDER_VALUE)) {
      firstOrder = true
    }
  }
  return { groups, firstOrder }
}

/**
 * Why a buyer may not use a promotion, as an error key; null when they may.
 * `inGroups` is null for a cart with no customer; `placedBefore` null when
 * the buyer is not known yet (a guest's cart before its e-mail), which the
 * checkout decides once the e-mail is there.
 */
export function refusalOf(
  restrictions: Restrictions,
  buyer: { groupIds: readonly string[] | null; placedBefore: boolean | null }
): string | null {
  if (restrictions.groups) {
    if (buyer.groupIds === null) {
      return "promotions.customer_group_login"
    }
    if (!restrictions.groups.some((id) => buyer.groupIds?.includes(id))) {
      return "promotions.customer_group_only"
    }
  }
  if (restrictions.firstOrder && buyer.placedBefore === true) {
    return "promotions.first_order_only"
  }
  return null
}
