import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { TenantStatus } from "@qticaret/types/control-plane"
import type { ReportedRelease } from "../../modules/fleet/service-releases"
import { fleetIn, tenantsIn } from "../../workflows/modules"
import { drifts, matchesTarget, sameRelease } from "./releases"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The shops a fleet-wide count looks at (Ek C18): every shop not being
 * closed (a closing or closed shop is never upgraded and reports no more).
 */
export const LIVE_STATUSES = [
  "provisioning",
  "active",
  "restricted",
  "suspended",
] as const satisfies readonly TenantStatus[]

/**
 * The most shops a fleet-wide count reads (one statement's worth of rows);
 * a fleet beyond it is F16's (paged counts), far beyond F17's.
 */
export const FLEET_MAX = 10_000

export interface LiveShop {
  id: string
  name: string
  slug: string
  status: TenantStatus
  status_changed_at: Date
  api_base_url: string | null
}

/**
 * Every live shop with what the counts need (no contact, no company), by
 * id. At `FLEET_MAX` the counts built on it are partial: a warning says so
 * (review I1; the bound only, no shop named).
 */
export async function liveShops(container: Container): Promise<LiveShop[]> {
  const shops: LiveShop[] = await tenantsIn(container).listTenants(
    { status: [...LIVE_STATUSES] },
    {
      select: ["id", "name", "slug", "status", "status_changed_at", "api_base_url"],
      order: { id: "ASC" },
      take: FLEET_MAX,
    }
  )
  if (shops.length >= FLEET_MAX) {
    warnCap(container, "live_shops", FLEET_MAX)
  }
  return shops
}

/** A bounded read hit its bound: the event and the bound, nothing about a shop. */
export function warnCap(container: Container, read: string, cap: number): void {
  container
    .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
    .warn(`cp.dashboard_cap_reached ${JSON.stringify({ read, cap })}`)
}

const reportedView = (report: ReportedRelease | undefined) =>
  report
    ? {
        version: report.version,
        commit: report.commit,
        reported_at: report.reported_at,
      }
    : null

/**
 * GET /admin/cp/releases's rows (Ek C18): each release, newest first, with
 * how many live shops report running it (their latest usage report) and
 * how many have it as their target.
 */
export async function releaseList(container: Container) {
  const fleet = fleetIn(container)
  const [releases, targets, shops] = await Promise.all([
    fleet.releases(),
    fleet.targets(),
    liveShops(container),
  ])
  const live = new Set(shops.map((shop) => shop.id))
  const reports = await fleet.latestReports([...live])
  const byVersion = new Map<string, typeof releases>()
  for (const release of releases) {
    byVersion.set(release.version, [...(byVersion.get(release.version) ?? []), release])
  }
  const reported = new Map<string, number>()
  for (const report of reports.values()) {
    for (const release of byVersion.get(report.version) ?? []) {
      if (sameRelease(report, release)) {
        reported.set(release.id, (reported.get(release.id) ?? 0) + 1)
      }
    }
  }
  const targeted = new Map<string, number>()
  for (const target of targets) {
    if (live.has(target.tenant_id)) {
      targeted.set(target.release_id, (targeted.get(target.release_id) ?? 0) + 1)
    }
  }
  return releases.map((release) => ({
    ...release,
    reported_count: reported.get(release.id) ?? 0,
    target_count: targeted.get(release.id) ?? 0,
  }))
}

/**
 * A shop's version as its page shows it (Ek C18): what its latest report
 * says it runs, its target (who set it, when; why to the roles that set
 * targets only), and whether the two agree (null when either is missing).
 */
export async function tenantVersionOf(
  container: Container,
  tenantId: string,
  options: {
    /** Staff names by user id (`staffNames`). */
    names: (ids: string[]) => Promise<Record<string, string>>
    showReason: boolean
  }
) {
  const fleet = fleetIn(container)
  const [reports, targets] = await Promise.all([
    fleet.latestReports([tenantId]),
    fleet.targetsOf([tenantId]),
  ])
  const reported = reportedView(reports.get(tenantId))
  const stored = targets.get(tenantId)
  const names = stored?.set_by ? await options.names([stored.set_by]) : {}
  const target = stored?.release
    ? {
        ...stored.release,
        set_at: stored.set_at,
        set_by: stored.set_by ? (names[stored.set_by] ?? null) : null,
        reason: options.showReason ? stored.reason : null,
      }
    : null
  return { reported, target, matches: matchesTarget(reported, stored?.release ?? null) }
}

/** The list's version column (Ek C18): each shop's reported version and whether it drifts. */
export async function listVersions(container: Container, tenantIds: readonly string[]) {
  const fleet = fleetIn(container)
  const [reports, targets] = await Promise.all([
    fleet.latestReports(tenantIds),
    fleet.targetsOf(tenantIds),
  ])
  return new Map(
    tenantIds.map((id) => {
      const report = reports.get(id) ?? null
      const target = targets.get(id)?.release ?? null
      return [
        id,
        {
          reported: report ? { version: report.version, commit: report.commit } : null,
          target: target ? { version: target.version } : null,
          drift: drifts(report, target),
        },
      ] as const
    })
  )
}
