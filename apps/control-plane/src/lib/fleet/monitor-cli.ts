import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CP_AUDIT_MODULE } from "../../modules/cp-audit"
import type CpAuditModuleService from "../../modules/cp-audit/service"
import type { TenantRecord } from "../../modules/tenants/types"
import { fleetIn, tenantsIn } from "../../workflows/modules"
import { parseEnv } from "../env"
import { localOnlyProblem } from "../local-only"
import { probeFleet } from "./health-probe"
import type { ProbeRun } from "./health-probe"
import { HEALTH_PROBES_LOCK } from "./health-rules"
import { storefrontPolicy, storefrontTargetProblem } from "./storefront-target"

/**
 * `cp:fleet`'s monitoring commands (Ek C13; scripts/fleet.ts):
 *
 * - `usage <slug>`: the latest usage snapshot and each target's standing
 * - `probe <slug>`: probes the shop now (as the five-minute job does)
 * - `set-storefront-url <slug> <url|none>`: its storefront home page, for
 *   the probe. Development only (this machine, ports 8000–8099); deployed,
 *   F16's provisioner sets it on a verified domain
 *
 * Prints counts, times, states and codes only.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

export async function printUsage(container: MedusaContainer, tenant: TenantRecord) {
  const fleet = fleetIn(container)
  const latest = await fleet.latestUsage(tenant.id)
  out(
    latest
      ? `usage reported=${latest.reported_at.toISOString()} period=${latest.period} ` +
          `products=${String(latest.products)} orders=${String(latest.orders_this_month)} ` +
          `staff=${String(latest.staff)} storage_mb=${String(latest.storage_mb)} ` +
          `llm=${String(latest.llm_credits_this_month)} ` +
          `release=${latest.release_version}+${latest.release_commit.slice(0, 12)}`
      : "usage: no report yet"
  )
  for (const row of await fleet.healthOf([tenant.id])) {
    out(
      `health ${row.target}=${row.state} failures=${String(row.consecutive_failures)} ` +
        `checked=${row.checked_at.toISOString()} latency_ms=${String(row.latency_ms ?? "-")} ` +
        `error=${row.error ?? "-"}`
    )
  }
}

/**
 * Probes the shop now, under the five-minute job's lock (review I1): while
 * a run holds it, nothing is probed and the command says so.
 */
export async function probeNow(container: MedusaContainer, tenant: TenantRecord) {
  let run: ProbeRun
  try {
    run = await container
      .resolve(Modules.LOCKING)
      .execute(HEALTH_PROBES_LOCK, () => probeFleet(container, { slugs: [tenant.slug] }), {
        timeout: 1,
      })
  } catch {
    out("cp:fleet: a probe run is going on; try again in a moment")
    return 1
  }
  out(`probe: ${JSON.stringify(run)}`)
  await printUsage(container, tenant)
  return run.probed > 0 ? 0 : 1
}

export async function setStorefrontUrl(
  container: MedusaContainer,
  tenant: TenantRecord,
  raw: string
): Promise<number> {
  const problem = localOnlyProblem(parseEnv())
  if (problem) {
    out(`cp:fleet: set-storefront-url runs ${problem}`)
    return 1
  }
  const url = raw === "none" ? null : raw
  const refused = url ? storefrontTargetProblem(url, storefrontPolicy([])) : null
  if (refused) {
    out(`cp:fleet: ${refused}: a base URL on this machine, port 8000-8099`)
    return 1
  }
  await tenantsIn(container).updateTenants({ id: tenant.id, storefront_url: url })
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "tenant.storefront_url_set",
    actor_type: "system",
    resource_type: "tenant",
    resource_id: tenant.id,
    changes: { storefront_url: { to: url } },
  })
  out(`cp:fleet: storefront ${url ? "set" : "removed"}`)
  return 0
}
