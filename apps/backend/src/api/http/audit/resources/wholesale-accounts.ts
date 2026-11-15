import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { likeLiteral } from "../../../../lib/db/like"
import { kurus, toMedusaAmount } from "../../../../lib/money"
import { normalizeEmail } from "../../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../../modules/wholesale"
import type WholesaleModuleService from "../../../../modules/wholesale/service"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Wholesalers (ADR-0068 §3, adr/0011): opened, changed, closed, reopened,
 * given a new password, taken back, and their own hand-entered prices, before
 * and after. The address, company and contact are not written (the
 * customer record and the account hold them); the tax number never is.
 * A new account is found by the address in its body.
 */

const wholesale = (scope: Resolver) => scope.resolve(WHOLESALE_MODULE) as WholesaleModuleService

type Account = Awaited<ReturnType<WholesaleModuleService["retrieveWholesaleAccount"]>>

const stamp = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

const accountSnapshot = (account: Account | undefined): Snapshot =>
  account
    ? {
        status: account.status,
        customer_id: account.customer_id ?? null,
        tier_id: account.tier_id ?? null,
        own_prices: account.private_price_list_id !== null,
        rate_bps: account.rate_bps ?? null,
        min_quantity: account.min_quantity ?? null,
        invited_at: stamp(account.invited_at),
        deactivated_at: stamp(account.deactivated_at),
      }
    : {}

async function accountById(scope: Resolver, id: string | undefined): Promise<Snapshot> {
  const [account] = await wholesale(scope).listWholesaleAccounts({ id: id ?? "" }, { take: 1 })
  return accountSnapshot(account)
}

/** A new account: pending under its address, or bound to the customer at that address. */
async function accountByEmail(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { email } = (body ?? {}) as { email?: unknown }
  if (typeof email !== "string" || email.trim() === "") {
    return {}
  }
  const address = normalizeEmail(email)
  const [pending] = await wholesale(scope).listWholesaleAccounts({ email: address }, { take: 1 })
  if (pending) {
    return accountSnapshot(pending)
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id"],
    filters: { email: { $ilike: likeLiteral(address) }, has_account: true },
  })
  const customerId = (data[0] as { id?: string } | undefined)?.id
  if (!customerId) {
    return {}
  }
  const [bound] = await wholesale(scope).listWholesaleAccounts(
    { customer_id: customerId },
    { take: 1 }
  )
  return accountSnapshot(bound)
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

async function ownPrices(scope: Resolver, id: string | undefined, body: unknown) {
  const [account] = await wholesale(scope).listWholesaleAccounts({ id: id ?? "" }, { take: 1 })
  const variants = variantsOf(body)
  if (!account?.private_price_list_id || variants.length === 0) {
    return {}
  }
  const marks = await wholesale(scope).listWholesaleManualPrices(
    { price_list_id: account.private_price_list_id, variant_id: variants },
    { take: null }
  )
  const snapshot: Snapshot = {}
  for (const mark of marks) {
    snapshot[`variant:${mark.variant_id}:net`] = toMedusaAmount(kurus(mark.net_amount))
  }
  return snapshot
}

const ACCOUNT = `/admin/wholesale/accounts/(?<id>${ID})`

const byId = (method: "POST" | "DELETE", suffix: string, route: string): AuditedResource => ({
  method,
  route: `${method} /admin/wholesale/accounts/:id${route}`,
  pattern: new RegExp(`^${ACCOUNT}${suffix}$`, "i"),
  resourceType: "wholesale_account",
  resourceId: (params) => params["id"] ?? null,
  snapshot: ({ scope, params }) => accountById(scope, params["id"]),
})

export const WHOLESALE_ACCOUNT_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/wholesale/accounts",
    pattern: /^\/admin\/wholesale\/accounts$/i,
    resourceType: "wholesale_account",
    resourceId: () => null,
    snapshot: ({ scope, body }) => accountByEmail(scope, body),
  },
  byId("POST", "", ""),
  byId("DELETE", "", ""),
  byId("POST", "/deactivate", "/deactivate"),
  byId("POST", "/reactivate", "/reactivate"),
  // Ek 2026-11-15 (2): that a new password was set, never the password
  byId("POST", "/password", "/password"),
  {
    method: "POST",
    route: "POST /admin/wholesale/accounts/:id/prices",
    pattern: new RegExp(`^${ACCOUNT}/prices$`, "i"),
    resourceType: "wholesale_account",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params, body }) => ownPrices(scope, params["id"], body),
  },
]
