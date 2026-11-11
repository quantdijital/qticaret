import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { followRun, printRun } from "../lib/provisioning/progress"
import { provisioner } from "../lib/provisioning/provider"
import { startRun } from "../lib/provisioning/runs"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { provisioningIn, tenantsIn } from "../workflows/modules"
import { contextOf } from "../workflows/provisioning/target"
import type { RunKind } from "../workflows/provisioning/workflows"

/**
 * `pnpm --filter control-plane cp:tenant <command> <slug>` (Ek C10), the
 * shop's setup from a terminal, the same runs as the panel's:
 *
 * - `status`: the latest run with its steps, and what the provisioner sees
 *   (store, process, health)
 * - `stop` / `start`: the shop's backend (only a process the provisioner
 *   started for it)
 * - `invite`: the owner's invitation again (a new link, mailed; nothing printed)
 * - `retry`: the setup again from the start, skipping what is there
 *
 * Statuses and codes only: no secret, no link.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

const KINDS: Readonly<Record<string, RunKind>> = {
  stop: "stop",
  start: "start",
  invite: "invite",
  retry: "create",
}

async function status(container: MedusaContainer, tenantId: string): Promise<number> {
  const runs = provisioningIn(container)
  const [latest] = await runs.runsOf(tenantId, 1)
  if (!latest) {
    out("cp:tenant: no run yet")
    return 0
  }
  printRun(await runs.runOf(tenantId, latest.id))
  const { target } = await contextOf(container, tenantId)
  const seen = await provisioner().probe(target)
  out(
    `shop: secrets=${String(seen.secrets)} running=${String(seen.running)} ` +
      `healthy=${String(seen.healthy)} port=${String(target.port)}`
  )
  return 0
}

export async function runTenantCommand(
  container: MedusaContainer,
  [command = "", slug = ""]: readonly string[]
): Promise<number> {
  const [tenant] = slug ? await tenantsIn(container).listTenants({ slug }, { take: 1 }) : []
  const kind = KINDS[command]
  if (!tenant || (command !== "status" && !kind)) {
    out("usage: cp:tenant status|stop|start|invite|retry <slug>")
    return 2
  }
  out(`tenant ${tenant.id} ${tenant.slug} (${tenant.status})`)
  if (!kind) {
    return await status(container, tenant.id)
  }
  const started = await startRun(container, { tenant_id: tenant.id, kind, requested_by: null })
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: `tenant.provisioning_${kind}`,
    actor_type: "system",
    resource_type: "tenant",
    resource_id: tenant.id,
    changes: { run: { to: started.run.id } },
  })
  const done = await followRun(container, started)
  return done.status === "succeeded" ? 0 : 1
}

export default async function tenant({ container, args }: ExecArgs) {
  process.exitCode = await runTenantCommand(container, args)
}
