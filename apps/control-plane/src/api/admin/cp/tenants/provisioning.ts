import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ProvisioningError } from "../../../../lib/provisioning/provisioner"
import { startRun } from "../../../../lib/provisioning/runs"
import type { RunView, StepView } from "../../../../modules/provisioning/service"
import type { RunKind } from "../../../../workflows/provisioning/workflows"
import { noteAuditChanges } from "../../../http/audit"
import { actorOf, tenantParam } from "./params"

/**
 * The shop's setup runs as the API shows them (Ek C10): ids, statuses,
 * codes and the steps' non-secret outputs. No secret, link or address is
 * ever in a run, so nothing here is masked.
 */

const stepView = (step: StepView) => ({
  name: step.name,
  position: step.position,
  status: step.status,
  attempts: step.attempts,
  created: step.created,
  error_code: step.error_code,
  output: step.output,
  started_at: step.started_at,
  finished_at: step.finished_at,
})

export const runView = (run: RunView) => ({
  id: run.id,
  kind: run.kind,
  status: run.status,
  provider: run.provider,
  requested_by: run.requested_by,
  port: run.port,
  error_code: run.error_code,
  started_at: run.started_at,
  finished_at: run.finished_at,
  ...(run.steps
    ? { steps: [...run.steps].sort((a, b) => a.position - b.position).map(stepView) }
    : {}),
})

/**
 * A run of `kind` started for the shop the path names, answered at once
 * (202): the run's page follows it. Another run of the shop under way:
 * 409 `cp.provisioning_busy`; a run the shop's status does not allow
 * (`RUN_STATUSES`, Ek C19 L2: a start also for a restricted or suspended
 * shop, an invitation or a pack only for one being set up or active): 409
 * `provisioning.tenant_status`; no provisioner here: 503
 * `cp.provisioner_unavailable`.
 */
export async function startFromRequest(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  kind: RunKind
): Promise<void> {
  const tenant = await tenantParam(req)
  let started
  try {
    started = await startRun(req.scope, {
      tenant_id: tenant.id,
      kind,
      requested_by: actorOf(req),
    })
  } catch (error) {
    if (error instanceof ProvisioningError && error.code === "cp.provisioner_unavailable") {
      res.status(503).json({ type: "unavailable", message: error.code })
      return
    }
    // Review L7: starting or inviting a shop that is not being set up nor active
    if (error instanceof ProvisioningError && error.code === "provisioning.tenant_status") {
      res.status(409).json({ type: "conflict", message: error.code })
      return
    }
    if (error instanceof MedusaError && error.message === "cp.provisioning_busy") {
      res.status(409).json({ type: "conflict", message: error.message })
      return
    }
    throw error
  }
  // Never rejects: the run's end is recorded on the run
  void started.done
  noteAuditChanges(req, { run: { to: started.run.id }, kind: { to: kind } })
  res.status(202).json({ run: runView(started.run) })
}
