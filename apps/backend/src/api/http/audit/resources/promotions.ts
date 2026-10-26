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

interface RuleRow {
  attribute?: string | null
  operator?: string | null
  values?: ({ value?: string | null } | null)[] | null
}

type Rules = (RuleRow | null)[] | null | undefined

interface PromotionRow {
  code?: string | null
  status?: string | null
  is_automatic?: boolean | null
  limit?: number | null
  campaign_id?: string | null
  rules?: Rules
  application_method?: {
    type?: string | null
    target_type?: string | null
    allocation?: string | null
    value?: unknown
    currency_code?: string | null
    max_quantity?: unknown
    apply_to_quantity?: unknown
    buy_rules_min_quantity?: unknown
    target_rules?: Rules
    buy_rules?: Rules
  } | null
}

interface CampaignRow {
  name?: string | null
  starts_at?: When
  ends_at?: When
  budget?: { type?: string | null; limit?: unknown; attribute?: string | null } | null
}

const graph = (scope: Resolver) => scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
const day = (when: When): string | null => (when ? new Date(when).toISOString() : null)
// Amounts come back as numbers (or numeric strings); anything else is left out
const amount = (value: unknown): string =>
  typeof value === "number" || typeof value === "string" ? String(value) : ""

// "item_total gte 250; items.product.id in prod_1,prod_2", sorted: the order rules come back in is not a change
const rulesText = (rules: Rules): string | null => {
  const lines = (rules ?? []).flatMap((rule) =>
    rule
      ? [
          `${rule.attribute ?? ""} ${rule.operator ?? ""} ${(rule.values ?? [])
            .flatMap((value) => (value?.value ? [value.value] : []))
            .sort()
            .join(",")}`.trim(),
        ]
      : []
  )
  return lines.length > 0 ? lines.sort().join("; ") : null
}

const RULE_FIELDS = (path: string) => [
  `${path}.attribute`,
  `${path}.operator`,
  `${path}.values.value`,
]

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
      "application_method.allocation",
      "application_method.value",
      "application_method.currency_code",
      "application_method.max_quantity",
      "application_method.apply_to_quantity",
      "application_method.buy_rules_min_quantity",
      ...RULE_FIELDS("rules"),
      ...RULE_FIELDS("application_method.target_rules"),
      ...RULE_FIELDS("application_method.buy_rules"),
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
    allocation: method?.allocation ?? null,
    // Buy X pay Y and caps: what decides how many units are free
    max_quantity: method ? amount(method.max_quantity) || null : null,
    apply_to_quantity: method ? amount(method.apply_to_quantity) || null : null,
    buy_rules_min_quantity: method ? amount(method.buy_rules_min_quantity) || null : null,
    rules: rulesText(row.rules),
    target_rules: rulesText(method?.target_rules),
    buy_rules: rulesText(method?.buy_rules),
  }
}

async function campaignSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "campaign",
    fields: ["name", "starts_at", "ends_at", "budget.type", "budget.limit", "budget.attribute"],
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
    budget: row.budget
      ? `${row.budget.type ?? ""} ${amount(row.budget.limit)} ${row.budget.attribute ?? ""}`.trim()
      : null,
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

// A promotion's rules changed in batches, and promotions moved into a campaign: the promotion's or campaign's summary
const nested = (
  path: string,
  resourceType: string,
  snapshot: typeof promotionSnapshot
): AuditedResource => ({
  method: "POST",
  route: `POST /admin/${path.replace("(?<id>ID)", ":id")}`,
  pattern: new RegExp(`^/admin/${path.replace("(?<id>ID)", `(?<id>${ID})`)}$`, "i"),
  resourceType,
  resourceId: (params) => params["id"] ?? null,
  snapshot: ({ scope, params }) => snapshot(scope, params["id"] ?? ""),
})

export const PROMOTION_RESOURCES: readonly AuditedResource[] = [
  ...resources("promotions", "promotion", promotionSnapshot),
  ...resources("campaigns", "campaign", campaignSnapshot),
  nested("promotions/(?<id>ID)/rules/batch", "promotion", promotionSnapshot),
  nested("promotions/(?<id>ID)/target-rules/batch", "promotion", promotionSnapshot),
  nested("promotions/(?<id>ID)/buy-rules/batch", "promotion", promotionSnapshot),
  nested("campaigns/(?<id>ID)/promotions", "campaign", campaignSnapshot),
  nested("promotions/(?<id>ID)/offer", "promotion", promotionSnapshot),
]
