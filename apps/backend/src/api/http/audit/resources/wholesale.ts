import { toMedusaAmount } from "../../../../lib/money"
import { kurus } from "../../../../lib/money"
import { WHOLESALE_MODULE } from "../../../../modules/wholesale"
import type WholesaleModuleService from "../../../../modules/wholesale/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Wholesale levels and their hand-entered prices (ADR-0068 §3, adr/0011):
 * name, rate and fewest units before and after; a price entered by hand
 * as `variant:<id>:net` → "1250.00" (KDV excluded). A new level is found
 * by the name in its body.
 */

const wholesale = (scope: Resolver) => scope.resolve(WHOLESALE_MODULE) as WholesaleModuleService

interface TierFields {
  name: string
  rate_bps: number | null
  min_quantity: number | null
}

const tierSnapshot = (tier: TierFields | undefined): Snapshot =>
  tier ? { name: tier.name, rate_bps: tier.rate_bps, min_quantity: tier.min_quantity } : {}

async function tierById(scope: Resolver, id: string | undefined): Promise<Snapshot> {
  const [tier] = await wholesale(scope).listWholesaleTiers({ id: id ?? "" }, { take: 1 })
  return tierSnapshot(tier)
}

async function tierByName(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { name } = (body ?? {}) as { name?: unknown }
  if (typeof name !== "string" || name.trim() === "") {
    return {}
  }
  const [tier] = await wholesale(scope).listWholesaleTiers({ name: name.trim() }, { take: 1 })
  return tierSnapshot(tier)
}

/** The variants a price request names, at most 100 by its schema. */
function variantsOf(body: unknown): string[] {
  const { set, remove } = (body ?? {}) as { set?: unknown; remove?: unknown }
  const named = [
    ...(Array.isArray(set)
      ? set.map((each) => (each as { variant_id?: unknown } | null)?.variant_id)
      : []),
    ...(Array.isArray(remove) ? (remove as unknown[]) : []),
  ]
  return [...new Set(named.filter((id): id is string => typeof id === "string"))].slice(0, 100)
}

async function manualPrices(scope: Resolver, tierId: string | undefined, body: unknown) {
  const [tier] = await wholesale(scope).listWholesaleTiers({ id: tierId ?? "" }, { take: 1 })
  const variants = variantsOf(body)
  if (!tier || variants.length === 0) {
    return {}
  }
  const marks = await wholesale(scope).listWholesaleManualPrices(
    { price_list_id: tier.price_list_id, variant_id: variants },
    { take: null }
  )
  const snapshot: Snapshot = {}
  for (const mark of marks) {
    snapshot[`variant:${mark.variant_id}:net`] = toMedusaAmount(kurus(mark.net_amount))
  }
  return snapshot
}

const TIER = `/admin/wholesale/tiers/(?<id>${ID})`

export const WHOLESALE_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/wholesale/tiers",
    pattern: /^\/admin\/wholesale\/tiers$/i,
    resourceType: "wholesale_tier",
    resourceId: () => null,
    snapshot: ({ scope, body }) => tierByName(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/wholesale/tiers/:id`,
    pattern: new RegExp(`^${TIER}$`, "i"),
    resourceType: "wholesale_tier",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      tierById(scope, params["id"]),
  })),
  {
    method: "POST",
    route: "POST /admin/wholesale/tiers/:id/prices",
    pattern: new RegExp(`^${TIER}/prices$`, "i"),
    resourceType: "wholesale_tier",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params, body }) => manualPrices(scope, params["id"], body),
  },
]
