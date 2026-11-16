import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { replaceDraftWorkflow } from "../../../../../../workflows/storefront/draft-replace"
import { draftSource } from "../../../../../../workflows/storefront/layout"
import { adminLayout } from "../../../read"
import type { AdminPostStorefrontLayoutRestoreType } from "../../../validators"

/**
 * POST /admin/storefront-layout/revisions/:revision/restore (adr/0049): an
 * earlier publication back into the draft, checked again (a record it
 * named may be gone); publishing it is a step of its own. The menu set it
 * put live comes too unless `menus` is false (adr/0063 §3). The draft it
 * replaces is kept first as an automatic save (adr/0064 Ek 2026-11-17).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontLayoutRestoreType>,
  res: MedusaResponse
): Promise<void> {
  const revision = Number(req.params["revision"])
  if (!Number.isInteger(revision) || revision < 1) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
  }
  const source = await draftSource(req.scope, revision, req.validatedBody.menus)
  const { result } = await replaceDraftWorkflow(req.scope).run({
    input: { source, actor: req.auth_context.actor_id, reason: "restore" },
  })
  res.json({ layout: await adminLayout(req.scope), auto_saved: result.auto_saved })
}
