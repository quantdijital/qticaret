import { targetRulesFor } from "./scope"
import type { Scope } from "./scope"

/**
 * What a promotion gives, in the shop's terms, from Medusa's application
 * method: a percentage or an amount off the basket, or free shipping
 * (100% off the shipping methods). Pure, so tested on its own.
 */

export type OfferKind = "percentage" | "fixed" | "free_shipping"

interface Method {
  type?: string | null
  target_type?: string | null
  value?: number | null
}

export function offerKind(method: Method | null | undefined): OfferKind {
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
  kind: OfferKind,
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
