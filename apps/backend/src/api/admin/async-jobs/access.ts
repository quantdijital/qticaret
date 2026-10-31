import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { jobType } from "../../../workflows/async-job/types"
import { staffRoleOf } from "../../http/staff-guard"

/**
 * Whether the person may see the job, or with `file` read its result
 * (adr/0014, adr/0040): a migration's only an owner, its asker included
 * only while one; a private one (an audit log export) and a file with
 * personal data its asker and the owner. An unknown kind counts as personal.
 */
export async function mayReach(
  req: AuthenticatedMedusaRequest,
  job: { type: string; requested_by: string | null },
  file = false
): Promise<boolean> {
  const type = jobType(job.type)
  const owner = async () => (await staffRoleOf(req)) === "owner"
  if (type?.ownerOnly) {
    return owner()
  }
  if (type?.privateToAsker || (file && (type?.containsPersonalData ?? true))) {
    return job.requested_by === req.auth_context.actor_id || owner()
  }
  return true
}
