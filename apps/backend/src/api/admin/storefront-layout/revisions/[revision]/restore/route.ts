import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { draftSource, saveLayoutDraftWorkflow } from "../../../../../../workflows/storefront/layout"
import { adminLayout } from "../../../read"
import type { AdminPostStorefrontLayoutRestoreType } from "../../../validators"

/**
 * POST /admin/storefront-layout/revisions/:revision/restore (adr/0049): an
 * earlier publication back into the draft, checked again (a record it
 * named may be gone); publishing it is a step of its own. The menu set it
 * put live comes too unless `menus` is false (adr/0063 §3).
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
  await saveLayoutDraftWorkflow(req.scope).run({ input: source })
  res.json({ layout: await adminLayout(req.scope) })
}
