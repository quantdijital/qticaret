import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { createBody } from "../form"
import { audienceOf, isAudienceRule, minimumOf, sameAudience, scopeOf } from "../scope"
import type { BudgetLike, RuleInput, RuleLike } from "../scope"
import type { Promotion } from "./promotions"

type Body = ReturnType<typeof createBody>

interface SaveInput {
  existing: Promotion | null
  body: Body
  /** The start or end day was changed in the form; otherwise the campaign's times stay as set. */
  datesChanged: boolean
  /** How often one customer may use it now; null for no such limit. */
  perCustomer: number | null
  perCustomerChanged: boolean
}

interface Detail {
  rules?: RuleLike[] | null
  application_method?: {
    target_rules?: RuleLike[] | null
    buy_rules?: RuleLike[] | null
  } | null
  campaign?: { id?: string | null; budget?: BudgetLike | null } | null
}

const sameRules = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

// The items it applies to and its "X al Y öde" rules, sent only when the scope changed
function scopeChange(existing: Promotion & Detail, body: Body) {
  const method = body.application_method
  const wantedTargets: RuleInput[] = "target_rules" in method ? (method.target_rules ?? []) : []
  const current = scopeOf(existing.application_method?.target_rules)
  const wanted = scopeOf(
    wantedTargets.map((rule) => ({
      attribute: rule.attribute,
      values: rule.values.map((value) => ({ value })),
    }))
  )
  if (current.scope === wanted.scope && sameRules(current.ids, wanted.ids)) {
    return {}
  }
  return {
    scope: {
      target_type: method.target_type === "items" ? ("items" as const) : ("order" as const),
      target_rules: wanted.scope === "all" ? [] : wantedTargets,
      ...("buy_rules" in method ? { buy_rules: method.buy_rules } : {}),
    },
  }
}

const asRules = (rules: readonly RuleInput[]): RuleLike[] =>
  rules.map((rule) => ({
    attribute: rule.attribute,
    values: rule.values.map((value) => ({ value })),
  }))

// The basket minimum, compared as the form shows it: "150" and "150.00" are one minimum
function minimumChange(existing: Promotion & Detail, body: Body) {
  const rules = body.rules.filter((rule) => !isAudienceRule(rule))
  return minimumOf(existing.rules) === minimumOf(asRules(rules)) ? {} : { minimum: rules }
}

// Who may use it (K1/K2): its customer groups and first-order rule, replaced together
function audienceChange(existing: Promotion & Detail, body: Body) {
  const rules = body.rules.filter((rule) => isAudienceRule(rule))
  return sameAudience(audienceOf(existing.rules), audienceOf(asRules(rules)))
    ? {}
    : { audience: rules }
}

/** What the form changed in an existing promotion, as `POST /admin/promotions/:id/offer` takes it. */
function offerChanges(input: SaveInput) {
  const existing = input.existing as Promotion & Detail
  const { body } = input
  const method = body.application_method
  const shipping = method.target_type === "shipping_methods"
  return {
    promotion: {
      code: body.code,
      is_automatic: body.is_automatic,
      limit: body.limit,
      ...(shipping
        ? {}
        : {
            application_method: {
              value: method.value,
              ...("apply_to_quantity" in method
                ? {
                    apply_to_quantity: method.apply_to_quantity,
                    buy_rules_min_quantity: method.buy_rules_min_quantity,
                  }
                : {}),
            },
          }),
    },
    ...(shipping ? {} : { ...scopeChange(existing, body), ...minimumChange(existing, body) }),
    ...audienceChange(existing, body),
    ...(input.perCustomerChanged ? { per_customer: { limit: input.perCustomer } } : {}),
    ...(input.datesChanged
      ? {
          dates: {
            starts_at: body.campaign?.starts_at ?? null,
            ends_at: body.campaign?.ends_at ?? null,
          },
        }
      : {}),
    ...(body.campaign ? { campaign: body.campaign } : {}),
  }
}

/**
 * A new promotion in one call; an existing one's changes in one call too,
 * which the server applies whole or not at all (code, limit and value; the
 * items and basket minimum; who may use it; its campaign's days and per-customer limit).
 */
export function useSavePromotion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveInput): Promise<string> => {
      if (!input.existing) {
        return (await sdk.admin.promotion.create(input.body)).promotion.id
      }
      const id = input.existing.id
      await sdk.client.fetch(`/admin/promotions/${encodeURIComponent(id)}/offer`, {
        method: "POST",
        body: offerChanges(input),
      })
      return id
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["promotions"] })
    },
  })
}
