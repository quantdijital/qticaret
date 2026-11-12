import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantVersionOf } from "../../../../../../lib/fleet/release-views"
import { fleetIn } from "../../../../../../workflows/modules"
import { setTargetReleaseWorkflow } from "../../../../../../workflows/fleet/releases"
import { noteAuditChanges } from "../../../../../http/audit"
import type { PostTargetReleaseType } from "../../../releases/validators"
import { actorOf, tenantParam } from "../../params"
import { staffNames } from "../../views"

/** A shop being closed is never upgraded: its target does not change. */
const CLOSED = new Set(["closing", "closed"])

/**
 * POST /admin/cp/tenants/:id/target-release (owner, operator, step-up; Ek
 * C18): the release the shop should run, or `null` for none, and why
 * (required, kept on the record, not in the audit row). Only intent:
 * nothing upgrades the shop until F16.6. 404 `cp.release_unknown`; 409
 * `cp.tenant_closed` for a closing or closed shop. The audit row has the
 * target before and after (release id and version).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostTargetReleaseType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  if (CLOSED.has(tenant.status)) {
    res.status(409).json({ type: "conflict", message: "cp.tenant_closed" })
    return
  }
  const { release_id, reason } = req.validatedBody
  const fleet = fleetIn(req.scope)
  const { result: before } = await setTargetReleaseWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, release_id, actor: actorOf(req), reason },
  })
  const releaseRef = async (id: string | null | undefined) => {
    if (!id) {
      return null
    }
    const release = await fleet.releaseOf(id).catch(() => null)
    return { id, version: release?.version ?? null }
  }
  noteAuditChanges(req, {
    target_release: {
      from: await releaseRef(before.row?.target_release_id),
      to: await releaseRef(release_id),
    },
  })
  res.json({
    version: await tenantVersionOf(req.scope, tenant.id, {
      names: (ids) => staffNames(req, ids),
      showReason: true,
    }),
  })
}
