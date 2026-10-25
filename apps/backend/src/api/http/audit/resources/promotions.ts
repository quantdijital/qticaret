import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Promotions and campaigns (adr/0011): what decides a discount a customer
 * gets, before and after: the code, its status and use limit, what it
 * takes off and from what, and the campaign's days and budget. The panel
 * changes these (P4); Medusa Admin can too.
 */

type When = string | Date | null | undefined

interface PromotionRow {
  code?: string | null
  status?: string | null
  is_automatic?: boolean | null
  limit?: number | null
  campaign_id?: string | null
  application_method?: {
    type?: string | null
    target_type?: string | null
    value?: unknown
    currency_code?: string | null
  } | null
}

interface CampaignRow {
  name?: string | null
  starts_at?: When
  ends_at?: When
  budget?: { type?: string | null; limit?: unknown } | null
}

const graph = (scope: Resolver) => scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
const day = (when: When): string | null => (when ? new Date(when).toISOString() : null)
// Amounts come back as numbers (or numeric strings); anything else is left out
const amount = (value: unknown): string =>
  typeof value === "number" || typeof value === "string" ? String(value) : ""

async function promotionSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "promotion",
    fields: [
      "code",
      "status",
      "is_automatic",
      "limit",
      "campaign_id",
      "application_method.type",
      "application_method.target_type",
      "application_method.value",
      "application_method.currency_code",
    ],
    filters: { id },
  })
  const row = data[0] as PromotionRow | undefined
  if (!row) {
    return {}
  }
  const method = row.application_method
  return {
    code: row.code ?? null,
    status: row.status ?? null,
    is_automatic: row.is_automatic ?? false,
    limit: row.limit ?? null,
    campaign_id: row.campaign_id ?? null,
    // "percentage 10 on order", "fixed 50 try on order"
    discount: method
      ? `${method.type ?? ""} ${amount(method.value)} ${method.currency_code ?? ""} on ${method.target_type ?? ""}`
          .replace(/\s+/g, " ")
          .trim()
      : null,
  }
}

async function campaignSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "campaign",
    fields: ["name", "starts_at", "ends_at", "budget.type", "budget.limit"],
    filters: { id },
  })
  const row = data[0] as CampaignRow | undefined
  if (!row) {
    return {}
  }
  return {
    name: row.name ?? null,
    starts_at: day(row.starts_at),
    ends_at: day(row.ends_at),
    budget: row.budget ? `${row.budget.type ?? ""} ${amount(row.budget.limit)}`.trim() : null,
  }
}

const resources = (path: string, resourceType: string, snapshot: typeof promotionSnapshot) =>
  (["POST", "DELETE"] as const).map((method): AuditedResource => ({
    method,
    route: `${method} /admin/${path}/:id`,
    pattern: new RegExp(`^/admin/${path}/(?<id>${ID})$`, "i"),
    resourceType,
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => snapshot(scope, params["id"] ?? ""),
  }))

export const PROMOTION_RESOURCES: readonly AuditedResource[] = [
  ...resources("promotions", "promotion", promotionSnapshot),
  ...resources("campaigns", "campaign", campaignSnapshot),
]
