import type { MedusaContainer } from "@medusajs/framework/types"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { billingIn, fleetIn, plansIn, tenantsIn } from "../../workflows/modules"
import { istanbulDay } from "../billing/days"
import { liveShops } from "../fleet/release-views"
import { attentionOf } from "./attention"
import { DASHBOARD_LIST, RENEWAL_DAYS, recurringRevenue, renewalWindow } from "./revenue"

type Container = Pick<MedusaContainer, "resolve">

/** A listed shop; its fields null when the record is gone (as the payments list says it). */
export interface ListedShop {
  id: string
  name: string | null
  slug: string | null
  status: TenantStatus | null
}

/** A dashboard list's payment: a charge, or a renewal whose charge is not open yet. */
export interface DuePayment {
  tenant: ListedShop
  /** The charge's id; null for a renewal whose charge opens later (`projected`). */
  charge_id: string | null
  due_on: string
  /** Kuruş; a projected renewal at its package's price today. */
  amount: number
  projected: boolean
}

const unknownShop = (id: string): ListedShop => ({ id, name: null, slug: null, status: null })

/**
 * GET /admin/cp/dashboard's answer (adr/0061 C18, Ek C18): counts and
 * sums, and short lists that lead to their pages. Every part is a count,
 * an aggregate or a bounded list (`DASHBOARD_LIST` rows); no query per
 * shop. Shop names and addresses are the only names in it.
 */
export async function dashboardOf(container: Container, now: Date) {
  const tenants = tenantsIn(container)
  const billing = billingIn(container)
  const fleet = fleetIn(container)
  const today = istanbulDay(now)
  const window = renewalWindow(today)
  const [counts, shops] = await Promise.all([tenants.statusCounts(), liveShops(container)])
  const liveIds = shops.map((shop) => shop.id)
  const [totals, overdue, upcoming, projected, reports, targets] = await Promise.all([
    // Review I1: the shops left out by status in the query itself, no id list, no cap
    billing.recurringTotals(),
    // The payments screen's own lists: one definition of "overdue" and "upcoming"
    billing.payments({ view: "overdue", today, limit: DASHBOARD_LIST, offset: 0 }),
    billing.payments({
      view: "upcoming",
      today,
      from: window.from,
      to: window.to,
      limit: DASHBOARD_LIST,
      offset: 0,
    }),
    billing.projectedRenewals({ ...window, limit: DASHBOARD_LIST }),
    fleet.latestReports(liveIds),
    fleet.targetsOf(liveIds),
  ])
  const packageIds = [...new Set(projected.byPackage.map((row) => row.package_id))]
  const prices = new Map(
    (packageIds.length ? await plansIn(container).packages({ id: packageIds }) : []).map((pkg) => [
      pkg.id,
      pkg.price,
    ])
  )
  const projectedTotal = projected.byPackage.reduce(
    (sum, row) => sum + row.count * (prices.get(row.package_id) ?? 0),
    0
  )
  const projectedCount = projected.byPackage.reduce((sum, row) => sum + row.count, 0)
  // The names of the shops the lists show (a few; some may be closed already)
  const listed = [
    ...new Set([
      ...overdue.rows.map((row) => row.tenant_id),
      ...upcoming.rows.map((row) => row.tenant_id),
      ...projected.next.map((row) => row.tenant_id),
    ]),
  ]
  const named = listed.length
    ? ((await tenants.listTenants(
        { id: listed },
        { select: ["id", "name", "slug", "status"], take: listed.length }
      )) as unknown as ListedShop[])
    : []
  const shopOf = (id: string) => named.find((shop) => shop.id === id) ?? unknownShop(id)
  const due: DuePayment[] = [
    ...upcoming.rows.map((row) => ({
      tenant: shopOf(row.tenant_id),
      charge_id: row.id,
      due_on: row.due_on,
      amount: row.amount,
      projected: false,
    })),
    ...projected.next.map((row) => ({
      tenant: shopOf(row.tenant_id),
      charge_id: null,
      due_on: row.due_on,
      amount: prices.get(row.package_id) ?? 0,
      projected: true,
    })),
  ].sort((a, b) => a.due_on.localeCompare(b.due_on))
  return {
    today,
    shops: {
      active: counts.active,
      restricted: counts.restricted,
      suspended: counts.suspended,
      provisioning: counts.provisioning,
      // Every shop that is not closed (a closing one still runs)
      total: Object.entries(counts)
        .filter(([status]) => status !== "closed")
        .reduce((sum, [, n]) => sum + n, 0),
    },
    revenue: recurringRevenue(totals),
    overdue: {
      count: overdue.count,
      total: overdue.total,
      oldest: overdue.rows.map((row) => ({
        tenant: shopOf(row.tenant_id),
        charge_id: row.id,
        due_on: row.due_on,
        amount: row.amount,
      })),
    },
    renewals: {
      days: RENEWAL_DAYS,
      from: window.from,
      to: window.to,
      count: upcoming.count + projectedCount,
      total: upcoming.total + projectedTotal,
      open: { count: upcoming.count, total: upcoming.total },
      projected: { count: projectedCount, total: projectedTotal },
      next: due.slice(0, DASHBOARD_LIST),
    },
    health: await attentionOf(container, shops, reports, targets, now),
  }
}
