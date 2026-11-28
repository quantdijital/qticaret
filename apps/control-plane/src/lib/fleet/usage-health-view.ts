import type { MedusaContainer } from "@medusajs/framework/types"
import type { HealthTarget } from "../../modules/fleet/models/health"
import type { HealthStatusRow, UsageSnapshotRow } from "../../modules/fleet/service-monitoring"
import type { TenantRecord } from "../../modules/tenants/types"
import { fleetIn } from "../../workflows/modules"
import { omit } from "../omit"
import {
  HEALTH_KEEP_MS,
  REPORT_MISSING_AFTER_MS,
  UNHEALTHY_AFTER,
  reportExpected,
  reportMissing,
} from "./health-rules"
import { isProbed } from "./health-probe"

type Container = Pick<MedusaContainer, "resolve">

/** Probes shown per target: two hours at one every five minutes. */
export const HISTORY_SHOWN = 24

const usageView = (row: UsageSnapshotRow | null) =>
  row
    ? {
        reported_at: row.reported_at,
        received_at: row.received_at,
        period: row.period,
        counts: {
          products: row.products,
          orders_this_month: row.orders_this_month,
          staff: row.staff,
          storage_mb: row.storage_mb,
          llm_credits_this_month: row.llm_credits_this_month,
        },
        last_order_at: row.last_order_at,
        release: { version: row.release_version, commit: row.release_commit },
      }
    : null

/**
 * A shop's usage and health as its page shows them (Ek C13): the latest
 * snapshot, whether the hourly report is overdue (a managed, running shop
 * only: `active`, `restricted` or `suspended` with an internal address,
 * Ek C19 L2; three hours without one since its last report or since its
 * status last changed), and per probed target its
 * standing, its last probes and how many of a day's answered.
 */
export async function usageHealthOf(container: Container, tenant: TenantRecord, now: Date) {
  const fleet = fleetIn(container)
  const [latest, standings, setups] = await Promise.all([
    fleet.latestUsage(tenant.id),
    fleet.healthOf([tenant.id]),
    fleet.latestSetups([tenant.id]),
  ])
  const expected = reportExpected(tenant)
  const since = new Date(now.getTime() - HEALTH_KEEP_MS)
  const target = async (name: HealthTarget, probed: boolean) => {
    const standing: HealthStatusRow | undefined = standings.find((row) => row.target === name)
    if (!standing) {
      return { probed, standing: null, history: [], day: { total: 0, ok: 0 } }
    }
    const [history, day] = await Promise.all([
      fleet.probeHistory(tenant.id, name, HISTORY_SHOWN),
      fleet.probeTally(tenant.id, name, since),
    ])
    return { probed, standing: omit(standing, "tenant_id", "target"), history, day }
  }
  const [backend, storefront] = await Promise.all([
    target("backend", tenant.api_base_url !== null && isProbed(tenant.status, "backend")),
    target("storefront", tenant.storefront_url !== null && isProbed(tenant.status, "storefront")),
  ])
  return {
    usage: usageView(latest),
    // Ek C21: its last reported setup checklist (yes/no) and when; null if it never sent one
    setup: setups.get(tenant.id) ?? null,
    report: {
      expected,
      missing:
        expected && reportMissing(latest?.received_at ?? null, now, tenant.status_changed_at),
      missing_after_hours: REPORT_MISSING_AFTER_MS / (60 * 60 * 1000),
    },
    health: { unhealthy_after: UNHEALTHY_AFTER, backend, storefront },
  }
}
