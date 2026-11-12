import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fleetIn } from "../../../../../workflows/modules"
import { setReleaseNotesWorkflow } from "../../../../../workflows/fleet/releases"
import { noteAuditChanges } from "../../../../http/audit"
import { paramOf } from "../../tenants/params"
import type { PostReleaseNotesType } from "../validators"

/**
 * POST /admin/cp/releases/:id (owner, operator, step-up; Ek C18): a
 * release's note, the only part of it that changes (its version and
 * commit are history). 404 `cp.release_unknown`. The audit row has the
 * note's lengths, never its text.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostReleaseNotesType>,
  res: MedusaResponse
): Promise<void> {
  const id = paramOf(req, "id")
  const { notes } = req.validatedBody
  const { result } = await setReleaseNotesWorkflow(req.scope).run({ input: { id, notes } })
  noteAuditChanges(req, {
    notes: { from_length: result.before?.length ?? 0, to_length: notes?.length ?? 0 },
  })
  res.json({ release: await fleetIn(req.scope).releaseOf(id) })
}
