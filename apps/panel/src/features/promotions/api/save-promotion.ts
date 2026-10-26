import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { createBody } from "../form"
import { ownsCampaign } from "../offer"
import {
  isPerCustomerBudget,
  minimumOf,
  minimumRuleIds,
  perCustomerBudget,
  scopeOf,
} from "../scope"
import type { BudgetLike, RuleInput, RuleLike } from "../scope"
import { campaignMembers } from "./promotions"
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

const ids = (rules: readonly (RuleLike | null)[] | null | undefined) =>
  (rules ?? []).flatMap((rule) => (rule?.id ? [rule.id] : []))

const batch = (
  id: string,
  kind: "rules" | "target-rules" | "buy-rules",
  create: RuleInput[],
  remove: string[]
) =>
  create.length + remove.length === 0
    ? Promise.resolve()
    : sdk.client.fetch(`/admin/promotions/${encodeURIComponent(id)}/${kind}/batch`, {
        method: "POST",
        body: { create, update: [], delete: remove },
      })

const sameRules = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

// The basket minimum and the items it applies to, replaced only when they changed
async function syncRules(existing: Promotion & Detail, body: Body) {
  const method = body.application_method
  const wantedTargets: RuleInput[] = "target_rules" in method ? (method.target_rules ?? []) : []
  const current = scopeOf(existing.application_method?.target_rules)
  const wanted = scopeOf(
    wantedTargets.map((rule) => ({
      attribute: rule.attribute,
      values: rule.values.map((value) => ({ value })),
    }))
  )
  if (current.scope !== wanted.scope || !sameRules(current.ids, wanted.ids)) {
    const old = ids(existing.application_method?.target_rules)
    // Items first get their rules, then the method aims at them; the reverse for the whole basket
    if (wanted.scope !== "all") {
      await batch(existing.id, "target-rules", wantedTargets, old)
    }
    await sdk.admin.promotion.update(existing.id, {
      application_method: { target_type: body.application_method.target_type },
    })
    if (wanted.scope === "all") {
      await batch(existing.id, "target-rules", [], old)
    }
    // "X al Y öde" counts what is bought from the same products it gives
    if ("buy_rules" in method) {
      await batch(
        existing.id,
        "buy-rules",
        method.buy_rules,
        ids(existing.application_method?.buy_rules)
      )
    }
  }
  // Compared as the form shows them: "150" and "150.00" are one minimum
  const wantedMinimum = minimumOf(
    body.rules.map((rule) => ({
      attribute: rule.attribute,
      values: rule.values.map((value) => ({ value })),
    }))
  )
  if (minimumOf(existing.rules) !== wantedMinimum) {
    await batch(existing.id, "rules", body.rules, minimumRuleIds(existing.rules))
  }
}

// A per-customer limit lives on the campaign's budget; a campaign others share, or a
// budget of another kind (a total spend, say), is not this form's to change
async function syncBudget(existing: Promotion & Detail, body: Body, perCustomer: number | null) {
  const campaignId = existing.campaign?.id
  if (!campaignId) {
    if (perCustomer && body.campaign) {
      const { campaign } = await sdk.admin.campaign.create(body.campaign)
      await sdk.admin.promotion.update(existing.id, { campaign_id: campaign.id })
    }
    return
  }
  const budget = existing.campaign?.budget
  if (budget ? !isPerCustomerBudget(budget) : !perCustomer) {
    return
  }
  if (!ownsCampaign(existing.id, await campaignMembers(campaignId))) {
    return
  }
  await sdk.admin.campaign.update(campaignId, {
    budget: budget ? { limit: perCustomer } : perCustomerBudget(perCustomer ?? 0),
  })
}

/**
 * A new promotion in one call. An existing one gets its code, limit and
 * value; its items and basket minimum through Medusa's rule batches; its
 * dates and per-customer limit on its campaign (made now if it had none).
 */
export function useSavePromotion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveInput): Promise<string> => {
      const { existing, body, datesChanged } = input
      if (!existing) {
        return (await sdk.admin.promotion.create(body)).promotion.id
      }
      const detail = existing as Promotion & Detail
      const method = body.application_method
      await sdk.admin.promotion.update(existing.id, {
        code: body.code,
        is_automatic: body.is_automatic,
        limit: body.limit,
        ...(method.target_type === "shipping_methods"
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
      })
      if (body.application_method.target_type !== "shipping_methods") {
        await syncRules(detail, body)
      }
      if (input.perCustomerChanged) {
        await syncBudget(detail, body, input.perCustomer)
      }
      if (!datesChanged) {
        return existing.id
      }
      const dates = {
        starts_at: body.campaign?.starts_at ?? null,
        ends_at: body.campaign?.ends_at ?? null,
      }
      // A campaign other promotions share keeps its dates as they are;
      // untouched days are not rewritten (a time set elsewhere would move to midnight)
      const campaignId = detail.campaign?.id
      if (campaignId) {
        if (ownsCampaign(existing.id, await campaignMembers(campaignId))) {
          await sdk.admin.campaign.update(campaignId, dates)
        }
      } else if (body.campaign && !input.perCustomer) {
        const { campaign } = await sdk.admin.campaign.create(body.campaign)
        await sdk.admin.promotion.update(existing.id, { campaign_id: campaign.id })
      }
      return existing.id
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["promotions"] })
    },
  })
}
