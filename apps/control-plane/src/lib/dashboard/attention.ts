import type { MedusaContainer } from "@medusajs/framework/types"
import type { HealthState, HealthTarget } from "../../modules/fleet/models/health"
import type { ReportedRelease, TargetRecord } from "../../modules/fleet/service-releases"
import { fleetIn } from "../../workflows/modules"
import { PROBED_STATUSES } from "../fleet/health-probe"
import { REPORT_MISSING_AFTER_MS, reportMissing } from "../fleet/health-rules"
import { warnCap } from "../fleet/release-views"
import type { LiveShop } from "../fleet/release-views"
import { drifts } from "../fleet/releases"
import { DASHBOARD_LIST } from "./revenue"

type Container = Pick<MedusaContainer, "resolve">

/** Standings read at most per state: the troubled ones only, normally a handful. */
const TROUBLED_MAX = 1_000

const SEVERITY: Record<HealthState, number> = { healthy: 0, failing: 1, unhealthy: 2 }

interface Standing {
  tenant_id: string
  target: HealthTarget
  state: HealthState
  checked_at: Date
  unhealthy_since: Date | null
  error: string | null
}

export type ShopRef = Pick<LiveShop, "id" | "name" | "slug" | "status">

export interface AttentionRow {
  tenant: ShopRef
  problem: "unhealthy" | "stale"
  /** The probed target that is unhealthy (its worse one); null for a stale report. */
  target: HealthTarget | null
  /** Since when: unhealthy since, or the last report (its activation when it never reported). */
  since: Date
  /** The failure's code (`health.timeout` …); null for a stale report. */
  error: string | null
}

const refOf = ({ id, name, slug, status }: LiveShop): ShopRef => ({ id, name, slug, status })

/**
 * The dashboard's attention list (Ek C18), from what C13 keeps:
 *
 * - **unhealthy:** a probed shop (`active`, `provisioning`) with a target
 *   `unhealthy` (three failed probes in a row); `failing` (fewer) is
 *   counted apart and not listed (it often passes on the next probe)
 * - **stale report:** a shop that should report (`active` with an address)
 *   whose last report, or its activation when it never reported, is older
 *   than `REPORT_MISSING_AFTER_MS` (three hours: the shop page's "rapor
 *   gelmiyor" rule, one threshold for both)
 * - **version drift:** a live shop with a target whose latest report is
 *   another release (counted; the releases page has the detail)
 *
 * Unhealthy shops first, longest first, then stale ones (not again when
 * listed unhealthy), oldest first;
 * `DASHBOARD_LIST` rows.
 */
export async function attentionOf(
  container: Container,
  shops: readonly LiveShop[],
  reports: ReadonlyMap<string, ReportedRelease>,
  targets: ReadonlyMap<string, TargetRecord>,
  now: Date
) {
  const byId = new Map(shops.map((shop) => [shop.id, shop]))
  const probed = new Set<string>(PROBED_STATUSES)
  // Review I1: worst first, then oldest, in a fixed order, so a cap drops the mildest
  const read = async (state: HealthState, order: "unhealthy_since" | "checked_at") => {
    const rows = (await fleetIn(container).listHealthStandings(
      { state },
      {
        select: ["tenant_id", "target", "state", "checked_at", "unhealthy_since", "error"],
        order: { [order]: "ASC", id: "ASC" },
        take: TROUBLED_MAX,
      }
    )) as unknown as Standing[]
    if (rows.length >= TROUBLED_MAX) {
      warnCap(container, `health_${state}`, TROUBLED_MAX)
    }
    return rows
  }
  const standings = [
    ...(await read("unhealthy", "unhealthy_since")),
    ...(await read("failing", "checked_at")),
  ]
  // Each shop's worse target
  const worst = new Map<string, { row: Standing; shop: LiveShop }>()
  for (const row of standings) {
    const shop = byId.get(row.tenant_id)
    if (!shop || !probed.has(shop.status)) {
      continue
    }
    const held = worst.get(row.tenant_id)
    if (!held || SEVERITY[row.state] > SEVERITY[held.row.state]) {
      worst.set(row.tenant_id, { row, shop })
    }
  }
  const unhealthy = [...worst.values()].filter(({ row }) => row.state === "unhealthy")
  const failing = worst.size - unhealthy.length
  const expected = shops.filter((shop) => shop.status === "active" && shop.api_base_url !== null)
  const stale = expected
    .map((shop) => ({ shop, last: reports.get(shop.id)?.received_at ?? null }))
    .filter(({ shop, last }) => reportMissing(last, now, shop.status_changed_at))
    .map(({ shop, last }) => ({ shop, since: new Date(last ?? shop.status_changed_at) }))
  const drift = shops.filter((shop) =>
    drifts(reports.get(shop.id) ?? null, targets.get(shop.id)?.release ?? null)
  ).length
  const rows: AttentionRow[] = [
    ...unhealthy
      .map(({ row, shop }) => ({
        tenant: refOf(shop),
        problem: "unhealthy" as const,
        target: row.target,
        since: new Date(row.unhealthy_since ?? row.checked_at),
        error: row.error,
      }))
      .sort((a, b) => a.since.getTime() - b.since.getTime()),
    // A shop listed as unhealthy is not listed again for its silence (it is counted)
    ...stale
      .filter(({ shop }) => worst.get(shop.id)?.row.state !== "unhealthy")
      .map(({ shop, since }) => ({
        tenant: refOf(shop),
        problem: "stale" as const,
        target: null,
        since,
        error: null,
      }))
      .sort((a, b) => a.since.getTime() - b.since.getTime()),
  ]
  return {
    unhealthy: unhealthy.length,
    failing,
    stale: stale.length,
    stale_after_hours: REPORT_MISSING_AFTER_MS / (60 * 60 * 1000),
    drift,
    shops: rows.slice(0, DASHBOARD_LIST),
  }
}
