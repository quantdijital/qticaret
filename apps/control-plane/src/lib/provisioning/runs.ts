import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import type { TenantStatus } from "@qticaret/types/control-plane"
import type { RunView } from "../../modules/provisioning/service"
import { provisioningIn, tenantsIn } from "../../workflows/modules"
import { codeOf } from "../../workflows/provisioning/step"
import { RUN_STEPS, WORKFLOW_OF } from "../../workflows/provisioning/workflows"
import type { RunKind } from "../../workflows/provisioning/workflows"
import { isLocalEnv, parseEnv } from "../env"
import { provisioner } from "./provider"
import { ProvisioningError } from "./provisioner"

export interface StartRunInput {
  tenant_id: string
  kind: RunKind
  /** The staff member; null for the system (a script). */
  requested_by: string | null
  /** Development and tests only: the named step fails first (the compensation is seen). */
  fail_at?: string | null
}

export interface StartedRun {
  run: RunView
  /** The run's end: its record with its steps. Never rejects. */
  done: Promise<RunView>
}

/**
 * A provisioning run opened and started (adr/0061 §6, Ek C10). The run's
 * row and its steps exist before the first step runs; the caller may wait
 * for `done` (the CLI) or answer at once and let the page follow (the API).
 * One run of a shop at a time (`cp.provisioning_busy`).
 */
/**
 * The statuses a run may start from (review L7, Ek C19 L2). A restricted
 * or suspended shop keeps running (its storefront sells, or answers its
 * 503; its orders are operated), so it may be started again after a
 * reboot; it gets no new owner invitation and no pack while its panel is
 * closed to such changes. Setup and stop are not limited here (setup has
 * its own rule; a closing shop is stopped).
 */
export const RUN_STATUSES: Partial<Record<RunKind, readonly TenantStatus[]>> = {
  start: ["provisioning", "active", "restricted", "suspended"],
  invite: ["provisioning", "active"],
  apply_pack: ["provisioning", "active"],
  // Audit 3.2: any shop that has a database, a closing one too (its last backup)
  backup: ["provisioning", "active", "restricted", "suspended", "closing"],
  // Audit 3.1: a shop that sells or keeps running; never one being set up or closed
  upgrade: ["active", "restricted", "suspended"],
}

export async function startRun(
  container: MedusaContainer,
  input: StartRunInput
): Promise<StartedRun> {
  const failAt = input.fail_at ?? null
  if (failAt !== null && !isLocalEnv(parseEnv())) {
    throw new ProvisioningError("provisioning.fail_at_local_only")
  }
  const which = provisioner()
  // Review L7, Ek C19 L2: which shops a run may touch (`RUN_STATUSES`);
  // stopping is always allowed (a closing shop is stopped)
  const allowed = RUN_STATUSES[input.kind]
  if (allowed) {
    const { status } = await tenantsIn(container).tenantOf(input.tenant_id)
    if (!allowed.includes(status)) {
      throw new ProvisioningError("provisioning.tenant_status")
    }
  }
  const run = await provisioningIn(container).openRun({
    tenant_id: input.tenant_id,
    kind: input.kind,
    provider: which.kind,
    requested_by: input.requested_by,
    steps: RUN_STEPS[input.kind],
  })
  return { run, done: execute(container, run, input.kind, failAt) }
}

async function execute(
  container: MedusaContainer,
  run: RunView,
  kind: RunKind,
  failAt: string | null
): Promise<RunView> {
  const runs = provisioningIn(container)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let failed: string | null = null
  try {
    const { errors } = await WORKFLOW_OF[kind](container).run({
      input: { run_id: run.id, tenant_id: run.tenant_id, fail_at: failAt },
      throwOnError: false,
    })
    if (errors.length > 0) {
      failed = codeOf(errors[0]?.error)
    }
  } catch (error) {
    failed = codeOf(error)
    logger.warn(
      `cp.provisioning_error ${JSON.stringify({ run_id: run.id, err: codeSummary(error) })}`
    )
  }
  try {
    // The failed step's own code says more than the workflow's error
    const steps = (await runs.runOf(run.tenant_id, run.id)).steps ?? []
    const code = failed
      ? (steps.find((step) => step.status === "failed")?.error_code ?? failed)
      : null
    await runs.finishRun(run.id, code ? "failed" : "succeeded", code)
    logger.info(
      `cp.provisioning_run ${JSON.stringify({
        run_id: run.id,
        tenant_id: run.tenant_id,
        kind,
        status: code ? "failed" : "succeeded",
        code,
      })}`
    )
    return await runs.runOf(run.tenant_id, run.id)
  } catch (error) {
    logger.error(
      `cp.provisioning_finish_failed ${JSON.stringify({ run_id: run.id, err: codeSummary(error) })}`
    )
    return { ...run, status: "failed", error_code: "provisioning.finish_failed" }
  }
}
