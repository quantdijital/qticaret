import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../../lib/errors"
import { decideUrl } from "../../../../../../workflows/migration/urls-read"
import type { AdminPostMigrationUrlDecisionType } from "../../../validators"

/**
 * `POST /admin/migrations/urls/:id/decision` (F14.7): the owner's word on
 * an old address, kept until the next apply writes it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostMigrationUrlDecisionType>,
  res: MedusaResponse
): Promise<void> {
  const { decision, target } = req.validatedBody
  if (decision === "redirect" && !target) {
    throw new ValidationError("migration.url_target_not_live", { field: "target" })
  }
  const saved = await decideUrl(
    req.scope,
    req.params["id"] ?? "",
    decision === "redirect" ? { decision, target: target ?? "" } : { decision },
    req.auth_context.actor_id || null
  )
  res.json({ url: saved })
}
