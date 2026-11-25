import { RuleType } from "@medusajs/framework/utils"

/**
 * What the panel's promotion form changed, turned into the steps that
 * apply it (F4.4/F4.5, ADR-0024); read against the promotion as it is
 * (`OfferState`). Pure, so the choices are tested on their own.
 */

export interface OfferRule {
  attribute: string
  operator: "in" | "gte"
  values: string[]
}

export interface OfferBudget {
  type: "use_by_attribute"
  attribute: string
  limit: number | null
}

/**
 * What changed in a promotion, as the panel's form saw it (F4.4/F4.5,
 * ADR-0024). Each part is there only when it changed.
 */
export interface UpdateOfferInput {
  id: string
  promotion: {
    code: string
    is_automatic: boolean
    limit: number | null
    application_method?:
      | {
          value: number
          apply_to_quantity?: number | undefined
          buy_rules_min_quantity?: number | undefined
        }
      | undefined
  }
  /** The items it applies to: the whole basket, or these rules ("X al Y öde" with its buy rules). */
  scope?:
    | {
        target_type: "items" | "order"
        target_rules: OfferRule[]
        buy_rules?: OfferRule[] | undefined
      }
    | undefined
  /** The rules that replace its basket minimum. */
  minimum?: OfferRule[] | undefined
  /** The rules that replace who may use it: customer groups, first order only (K1/K2). */
  audience?: OfferRule[] | undefined
  per_customer?: { limit: number | null } | undefined
  dates?: { starts_at: string | null; ends_at: string | null } | undefined
  /** A campaign of its own, made when it needs one and has none. */
  campaign?:
    | {
        name: string
        campaign_identifier: string
        starts_at: string | null
        ends_at: string | null
        budget?: OfferBudget | undefined
      }
    | undefined
}

// Never run: `when` guards every batch; the type wants one all the same
export const EMPTY_BATCH = { id: "", rule_type: RuleType.RULES, create: [], delete: [] }

export const MINIMUM_ATTRIBUTE = "item_total"
export const PER_CUSTOMER_ATTRIBUTE = "customer_id"

export interface OfferState {
  target_rule_ids: string[]
  buy_rule_ids: string[]
  minimum_rule_ids: string[]
  audience_rule_ids: string[]
  campaign_id: string | null
  /** No other promotion shares its campaign: its days and budget are this form's. */
  owns_campaign: boolean
  per_customer_budget: boolean
  has_budget: boolean
}

const day = (when: string | null) => (when ? new Date(when) : null)

// A campaign made for the promotion, its days as Medusa takes them
const newCampaignOf = (campaign: NonNullable<UpdateOfferInput["campaign"]>) => ({
  name: campaign.name,
  campaign_identifier: campaign.campaign_identifier,
  starts_at: day(campaign.starts_at),
  ends_at: day(campaign.ends_at),
  ...(campaign.budget ? { budget: campaign.budget } : {}),
})

// The days as Medusa's campaign takes them (the panel sends ISO strings)
const datesOf = (dates: { starts_at: string | null; ends_at: string | null } | undefined) =>
  dates
    ? {
        starts_at: dates.starts_at ? new Date(dates.starts_at) : null,
        ends_at: dates.ends_at ? new Date(dates.ends_at) : null,
      }
    : {}

/** The campaign's changes: a shared campaign keeps its days, a budget of another kind stays. */
function campaignChanges(input: UpdateOfferInput, state: OfferState) {
  if (!state.campaign_id || !state.owns_campaign) {
    return null
  }
  const perCustomer = input.per_customer
  const budget =
    perCustomer && (state.has_budget ? state.per_customer_budget : perCustomer.limit !== null)
      ? state.has_budget
        ? { limit: perCustomer.limit }
        : {
            type: "use_by_attribute" as const,
            attribute: PER_CUSTOMER_ATTRIBUTE,
            limit: perCustomer.limit,
          }
      : null
  if (!budget && !input.dates) {
    return null
  }
  return { id: state.campaign_id, ...(budget ? { budget } : {}), ...datesOf(input.dates) }
}

// The promotion's own fields, each only when sent
function promotionFields(input: UpdateOfferInput) {
  const { application_method: method, ...fields } = input.promotion
  return {
    id: input.id,
    ...fields,
    ...(method
      ? {
          application_method: {
            value: method.value,
            ...(method.apply_to_quantity === undefined
              ? {}
              : { apply_to_quantity: method.apply_to_quantity }),
            ...(method.buy_rules_min_quantity === undefined
              ? {}
              : { buy_rules_min_quantity: method.buy_rules_min_quantity }),
          },
        }
      : {}),
  }
}

/** Every change the input asks for, read against the promotion as it is. */
export function planOffer(input: UpdateOfferInput, state: OfferState) {
  const scope = input.scope
  const items = scope?.target_type === "items"
  const batch = (rule_type: RuleType, create: OfferRule[], remove: string[]) =>
    create.length + remove.length > 0 ? { id: input.id, rule_type, create, delete: remove } : null
  const wantsCampaign =
    (input.per_customer?.limit !== null && input.per_customer !== undefined) || Boolean(input.dates)
  return {
    fields: { promotionsData: [promotionFields(input)] },
    // Items get their rules before the method aims at them; the whole basket the other way round
    itemRules:
      scope && items
        ? batch(RuleType.TARGET_RULES, scope.target_rules, state.target_rule_ids)
        : null,
    targetType: scope
      ? {
          promotionsData: [
            { id: input.id, application_method: { target_type: scope.target_type } },
          ],
        }
      : null,
    basketRules: scope && !items ? batch(RuleType.TARGET_RULES, [], state.target_rule_ids) : null,
    buyRules: scope?.buy_rules
      ? batch(RuleType.BUY_RULES, scope.buy_rules, state.buy_rule_ids)
      : null,
    minimum: input.minimum ? batch(RuleType.RULES, input.minimum, state.minimum_rule_ids) : null,
    audience: input.audience
      ? batch(RuleType.RULES, input.audience, state.audience_rule_ids)
      : null,
    campaign: campaignChanges(input, state),
    newCampaign:
      !state.campaign_id && wantsCampaign && input.campaign ? newCampaignOf(input.campaign) : null,
  }
}
