import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { istanbulDay } from "../../../../lib/billing/days"
import { chargeStanding, graceEndsOn } from "../../../../lib/billing/rules"
import { billingIn } from "../../../../workflows/modules"
import { PAYMENT_VIEWS } from "../billing/validators"
import type { GetPaymentsType } from "../billing/validators"
import { tenantsOf } from "../tenants/params"
import { staffNames } from "../tenants/views"

// `%` and `_` typed into the search are letters, not patterns
const likeOf = (q: string) => `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

const SEARCH_PAGE = 500
// Beyond this many matching shops the search says it looked at the first ones only
const SEARCH_MAX = 10_000

/** The shops a search names, page by page, up to `SEARCH_MAX` (and whether there were more). */
async function matchingShops(
  req: AuthenticatedMedusaRequest,
  q: string
): Promise<{ ids: string[]; truncated: boolean }> {
  const ids: string[] = []
  const filter = { $or: [{ name: { $ilike: likeOf(q) } }, { slug: { $ilike: likeOf(q) } }] }
  for (let skip = 0; skip < SEARCH_MAX; skip += SEARCH_PAGE) {
    const page = await tenantsOf(req).listTenants(filter, {
      select: ["id"],
      order: { id: "ASC" },
      skip,
      take: SEARCH_PAGE,
    })
    ids.push(...page.map((tenant) => tenant.id))
    if (page.length < SEARCH_PAGE) {
      return { ids, truncated: false }
    }
  }
  return { ids, truncated: true }
}

/**
 * GET /admin/cp/payments (all staff; adr/0061 §7 "yaklaşan / geciken",
 * Ek C16): one list (upcoming, overdue or paid) with its count and total,
 * each tab's count, each row's shop and where it stands; by a shop's name
 * or address and between two days. Amounts and days only.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetPaymentsType>,
  res: MedusaResponse
): Promise<void> {
  const { view, q, from, to, limit, offset } = req.validatedQuery as GetPaymentsType
  const today = istanbulDay(new Date())
  const billing = billingIn(req.scope)
  const search = q ? await matchingShops(req, q) : undefined
  const matched = search?.ids
  const scope = { today, tenant_id: matched, from, to }
  const counts = Object.fromEntries(
    await Promise.all(
      PAYMENT_VIEWS.map(async (each) => [
        each,
        matched?.length === 0
          ? 0
          : (await billing.payments({ ...scope, view: each, limit: 1, offset: 0 })).count,
      ])
    )
  ) as Record<(typeof PAYMENT_VIEWS)[number], number>
  res.setHeader("Cache-Control", "no-store")
  if (matched?.length === 0) {
    res.json({
      payments: [],
      count: 0,
      total: 0,
      counts,
      limit,
      offset,
      today,
      search_truncated: false,
    })
    return
  }
  const page = await billing.payments({ ...scope, view, limit, offset })
  const ids = [...new Set(page.rows.map((row) => row.tenant_id))]
  const shops = ids.length
    ? await tenantsOf(req).listTenants(
        { id: ids },
        { select: ["id", "name", "slug", "status"], take: ids.length }
      )
    : []
  const byId = new Map(shops.map((shop) => [shop.id, shop]))
  const names = await staffNames(
    req,
    page.rows.map((row) => row.settled_by)
  )
  res.json({
    payments: page.rows.map((row) => ({
      id: row.id,
      tenant: byId.get(row.tenant_id) ?? {
        id: row.tenant_id,
        name: null,
        slug: null,
        status: null,
      },
      period_start: row.period_start,
      period_end: row.period_end,
      amount: row.amount,
      currency_code: row.currency_code,
      due_on: row.due_on,
      status: row.status,
      standing: row.status === "open" ? chargeStanding(row.due_on, row.grace_days, today) : null,
      grace_ends_on: graceEndsOn(row.due_on, row.grace_days),
      paid_on: row.paid_on,
      method: row.method,
      settled_by: row.settled_by ? (names[row.settled_by] ?? null) : null,
    })),
    count: page.count,
    total: page.total,
    counts,
    limit,
    offset,
    today,
    // Review: a search matching more shops than are looked at says so, never cuts silently
    search_truncated: search?.truncated ?? false,
  })
}
