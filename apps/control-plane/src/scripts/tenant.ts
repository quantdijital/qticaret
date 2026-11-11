import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { reissuePlanDocuments } from "../lib/fleet/reissue"
import { followRun, printRun } from "../lib/provisioning/progress"
import { provisioner } from "../lib/provisioning/provider"
import { startRun } from "../lib/provisioning/runs"
import { MANUAL_STATUS_MOVES } from "../lib/tenants/status-moves"
import type { ManualStatusMove } from "../lib/tenants/status-moves"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { provisioningIn, tenantsIn } from "../workflows/modules"
import { contextOf } from "../workflows/provisioning/target"
import type { RunKind } from "../workflows/provisioning/workflows"
import { moveTenantStatusWorkflow } from "../workflows/tenants/tenant-status"

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
 * - `apply-pack`: the shop's sector pack again (C12): only what it never had
 * - `suspend` / `resume`: the shop suspended or opened again, `reason=` required (C15)
 *
 * Statuses and codes only: no secret, no link.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

const KINDS: Readonly<Record<string, RunKind>> = {
  stop: "stop",
  start: "start",
  invite: "invite",
  retry: "create",
  "apply-pack": "apply_pack",
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

/**
 * Ek C15: `suspend` / `resume <slug> reason=<why>`, the panel's moves from a
 * terminal: the same workflow and reissue, recorded as the system's.
 */
async function moveStatus(
  container: MedusaContainer,
  tenantId: string,
  move: ManualStatusMove,
  args: readonly string[]
): Promise<number> {
  const reason = args
    .find((arg) => arg.startsWith("reason="))
    ?.slice("reason=".length)
    .trim()
  if (!reason || reason.length < 3 || reason.length > 500) {
    out(`usage: cp:tenant ${move} <slug> reason=<3-500 characters>`)
    return 2
  }
  let moved: { from: string; to: string }
  try {
    moved = (
      await moveTenantStatusWorkflow(container).run({
        input: { tenant_id: tenantId, move, actor: "system", note: reason },
      })
    ).result
  } catch (error) {
    out(`cp:tenant: ${(error as { message?: string }).message ?? "failed"}`)
    return 1
  }
  out(`status ${moved.from} -> ${moved.to}`)
  // The shop hears it first; each failure after the move is said on its own (review I3)
  let failed = false
  const issued = (await reissuePlanDocuments(container, [tenantId])).get(tenantId)
  if (issued) {
    out(`plan document serial ${String(issued.serial)}`)
  } else {
    out("cp:tenant: plan document not issued (cp.plan_issue_failed); the reconcile job retries")
    failed = true
  }
  try {
    await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
      kind: "system",
      action: `tenant.${move}`,
      actor_type: "system",
      resource_type: "tenant",
      resource_id: tenantId,
      changes: { status: { from: moved.from, to: moved.to } },
    })
  } catch (error) {
    out(`cp:tenant: audit row not written: ${(error as { message?: string }).message ?? "failed"}`)
    failed = true
  }
  return failed ? 1 : 0
}

export async function runTenantCommand(
  container: MedusaContainer,
  [command = "", slug = "", ...rest]: readonly string[]
): Promise<number> {
  const [tenant] = slug ? await tenantsIn(container).listTenants({ slug }, { take: 1 }) : []
  if (tenant && (MANUAL_STATUS_MOVES as readonly string[]).includes(command)) {
    out(`tenant ${tenant.id} ${tenant.slug} (${tenant.status})`)
    return await moveStatus(container, tenant.id, command as ManualStatusMove, rest)
  }
  const kind = KINDS[command]
  if (!tenant || (command !== "status" && !kind)) {
    out(
      "usage: cp:tenant status|stop|start|invite|retry|apply-pack <slug>; suspend|resume <slug> reason=<why>"
    )
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
