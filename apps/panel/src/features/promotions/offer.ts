import type { StatusTone } from "@/components/patterns/status-badge"
import { targetRulesFor } from "./scope"
import type { Scope } from "./scope"

/**
 * What a promotion gives, in the shop's terms, from Medusa's application
 * method: a percentage or an amount off the basket, free shipping (100%
 * off the shipping methods), or "X al Y öde" (Medusa's buy-get: every X
 * units of the chosen products, the cheapest X − Y free). Pure, so tested
 * on its own.
 */

export type OfferKind = "percentage" | "fixed" | "free_shipping" | "buyget"

interface Method {
  type?: string | null
  target_type?: string | null
  value?: number | null
  apply_to_quantity?: number | null
  buy_rules_min_quantity?: number | null
}

// How many free units a basket may get in all: enough for any basket, so the offer repeats
const MAX_FREE_UNITS = 1000

export function offerKind(method: Method | null | undefined): OfferKind {
  if (method?.buy_rules_min_quantity) {
    return "buyget"
  }
  if (
    method?.target_type === "shipping_methods" &&
    method.type === "percentage" &&
    method.value === 100
  ) {
    return "free_shipping"
  }
  return method?.type === "fixed" ? "fixed" : "percentage"
}

/** The application method a kind and value become; amounts are gross (KDV included). */
export function applicationMethod(
  kind: Exclude<OfferKind, "buyget">,
  value: number,
  currency: string,
  scope: { scope: Scope; ids: readonly string[] } = { scope: "all", ids: [] }
) {
  if (kind === "free_shipping") {
    return {
      type: "percentage" as const,
      target_type: "shipping_methods" as const,
      allocation: "each" as const,
      value: 100,
    }
  }
  // Some items only: the discount spreads over the matching lines (F4.4)
  const items = scope.scope !== "all"
  return {
    type: kind,
    target_type: items ? ("items" as const) : ("order" as const),
    allocation: "across" as const,
    value,
    ...(kind === "fixed" ? { currency_code: currency } : {}),
    ...(items ? { target_rules: targetRulesFor(scope.scope, scope.ids) } : {}),
  }
}

/**
 * "X al Y öde" as Medusa's buy-get: Y units bought give X − Y more of the
 * same products free (the cheapest first), as often as the basket allows.
 */
export function buyGetMethod(
  buy: number,
  pay: number,
  scope: { scope: Scope; ids: readonly string[] }
) {
  const rules = targetRulesFor(scope.scope, scope.ids)
  return {
    type: "percentage" as const,
    target_type: "items" as const,
    allocation: "each" as const,
    value: 100,
    max_quantity: MAX_FREE_UNITS,
    apply_to_quantity: buy - pay,
    buy_rules_min_quantity: pay,
    buy_rules: rules,
    target_rules: rules,
  }
}

/** "X al Y öde" back from Medusa's method; null for another kind of offer. */
export function buyGetOf(method: Method | null | undefined): { buy: number; pay: number } | null {
  const pay = method?.buy_rules_min_quantity ?? 0
  const free = method?.apply_to_quantity ?? 0
  return pay > 0 && free > 0 ? { buy: pay + free, pay } : null
}

type When = string | Date | null | undefined

/** Running, waiting for its start, or past its end, given the status and dates. */
export function scheduleOf(
  status: string,
  campaign: { starts_at?: When; ends_at?: When } | null | undefined,
  now: Date = new Date()
): "active" | "scheduled" | "ended" | "draft" | "inactive" {
  if (status !== "active") {
    return status === "draft" ? "draft" : "inactive"
  }
  if (campaign?.starts_at && new Date(campaign.starts_at) > now) {
    return "scheduled"
  }
  if (campaign?.ends_at && new Date(campaign.ends_at) < now) {
    return "ended"
  }
  return "active"
}

/**
 * The promotion is its campaign's only member: the campaign holds just its
 * dates, so the panel may change or delete it. A campaign made elsewhere for
 * several promotions (with a budget, say) is left alone; unknown counts as shared.
 */
export function ownsCampaign(
  promotionId: string,
  members: ({ id: string } | null)[] | null | undefined
): boolean {
  return Array.isArray(members) && members.every((member) => member?.id === promotionId)
}

/** How each schedule state looks; price lists share them (F4.1). */
export const SCHEDULE_TONE: Record<ReturnType<typeof scheduleOf>, StatusTone> = {
  active: "success",
  scheduled: "info",
  draft: "neutral",
  ended: "neutral",
  inactive: "warning",
}
