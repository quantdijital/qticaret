import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { jobType } from "../../../workflows/async-job/types"
import { staffRoleOf } from "../../http/staff-guard"

/**
 * Whether the person may see the job, or with `file` read its result
 * (adr/0014, adr/0040): the platform's own, and the runs its schedule
 * started of a kind staff may also start, no one in the shop (docs/06
 * principle 10); a migration's only an owner, its asker included only
 * while one, and so a kind this code no longer knows; a private one (an
 * audit log export) and a file with personal data its asker and the owner.
 */
export async function mayReach(
  req: AuthenticatedMedusaRequest,
  job: { type: string; requested_by: string | null },
  file = false
): Promise<boolean> {
  const type = jobType(job.type)
  if (type?.platform || (type?.scheduled && job.requested_by === null)) {
    return false
  }
  const owner = async () => (await staffRoleOf(req)) === "owner"
  // A kind this code no longer knows tells nothing of what it holds: the owner's
  if (!type || type.ownerOnly) {
    return owner()
  }
  // The wholesale sync: the owner's and admin's (ADR-0068 decision 17)
  if (type.managersOnly) {
    const role = await staffRoleOf(req)
    return role === "owner" || role === "admin"
  }
  if (type.privateToAsker || (file && type.containsPersonalData)) {
    return job.requested_by === req.auth_context.actor_id || owner()
  }
  return true
}
