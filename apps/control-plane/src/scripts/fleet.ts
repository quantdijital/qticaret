import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { parseEnv } from "../lib/env"
import { printReleases, printUsage, probeNow, setStorefrontUrl } from "../lib/fleet/monitor-cli"
import { pushPlanDocument } from "../lib/fleet/push"
import { tenantApiUrlProblem } from "../lib/fleet/push-target"
import { reissuePlanDocuments } from "../lib/fleet/reissue"
import { localOnlyProblem } from "../lib/local-only"
import { fleetIn, tenantsIn } from "../workflows/modules"

/**
 * `pnpm --filter control-plane cp:fleet <command>` (adr/0061 Ek C9):
 *
 * - `status <slug>`: the shop's latest plan document: serial, time, push
 *   and last pull
 * - `issue <slug>`: its document issued again if its content changed,
 *   then pushed now; prints the push's outcome
 * - `set-api-url <slug> <url|none>`: where its document is pushed. On a
 *   developer's machine only (the provisioner sets it once deployed, C10);
 *   the URL must pass the push policy (`CP_TENANT_API_HOSTS`, loopback)
 * - Ek C13: `usage <slug>`, `probe <slug>`, `set-storefront-url <slug>
 *   <url|none>` (lib/fleet/monitor-cli.ts)
 * - Ek C18: `releases`: the releases and how many shops report and target each
 *
 * Prints serials, times and error codes only; no document body.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

async function tenantBySlug(container: MedusaContainer, slug: string) {
  const [tenant] = await tenantsIn(container).listTenants({ slug }, { take: 1 })
  return tenant ?? null
}

async function printStatus(container: MedusaContainer, tenantId: string): Promise<void> {
  const summary = await fleetIn(container).planDocumentSummary(tenantId)
  if (!summary) {
    out("cp:fleet: no plan document yet (a shop needs a package)")
    return
  }
  out(
    `serial=${String(summary.serial)} issued=${summary.issued_at.toISOString()} ` +
      `push=${summary.push_status}${summary.push_error ? `(${summary.push_error})` : ""} ` +
      `attempts=${String(summary.push_attempts)} pulled=${summary.pulled_at?.toISOString() ?? "-"}`
  )
}

async function setApiUrl(container: MedusaContainer, tenantId: string, raw: string) {
  const problem = localOnlyProblem(parseEnv())
  if (problem) {
    out(`cp:fleet: set-api-url runs ${problem}`)
    return 1
  }
  const url = raw === "none" ? null : raw
  const refused = url ? tenantApiUrlProblem(url) : null
  if (refused) {
    out(
      `cp:fleet: ${refused}: a base URL on this machine (port 9000 or 9200-9299) or in CP_TENANT_API_HOSTS`
    )
    return 1
  }
  await tenantsIn(container).updateTenants({ id: tenantId, api_base_url: url })
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "tenant.api_base_url_set",
    actor_type: "system",
    resource_type: "tenant",
    resource_id: tenantId,
    changes: { api_base_url: { to: url } },
  })
  out(`cp:fleet: push target ${url ? "set" : "removed"}`)
  return 0
}

export async function runFleetCommand(
  container: MedusaContainer,
  [command = "", slug = "", value = ""]: readonly string[]
): Promise<number> {
  if (command === "releases") {
    await printReleases(container)
    return 0
  }
  const tenant = slug ? await tenantBySlug(container, slug) : null
  const commands = ["status", "issue", "set-api-url", "usage", "probe", "set-storefront-url"]
  if (!tenant || !commands.includes(command)) {
    out(
      "usage: cp:fleet status <slug> | issue <slug> | set-api-url <slug> <url|none> | " +
        "usage <slug> | probe <slug> | set-storefront-url <slug> <url|none> | releases"
    )
    return 2
  }
  switch (command) {
    case "usage":
      await printUsage(container, tenant)
      return 0
    case "probe":
      return await probeNow(container, tenant)
    case "set-storefront-url":
      return await setStorefrontUrl(container, tenant, value)
    case "status":
      await printStatus(container, tenant.id)
      return 0
    case "issue": {
      const result = (await reissuePlanDocuments(container, [tenant.id], { push: false })).get(
        tenant.id
      )
      if (!result?.id) {
        out("cp:fleet: nothing issued (no package, or the issue failed: see the log)")
        return 1
      }
      out(`cp:fleet: serial ${String(result.serial)} ${result.issued ? "issued" : "unchanged"}`)
      const latest = await fleetIn(container).latestPlanDocument(tenant.id)
      if (latest?.push_status === "pending") {
        const outcome = await pushPlanDocument(container, latest)
        out(`cp:fleet: push ${outcome.delivered ? "delivered" : outcome.error}`)
      }
      await printStatus(container, tenant.id)
      return 0
    }
    default:
      return await setApiUrl(container, tenant.id, value)
  }
}

export default async function fleet({ container, args }: ExecArgs) {
  process.exitCode = await runFleetCommand(container, args)
}
