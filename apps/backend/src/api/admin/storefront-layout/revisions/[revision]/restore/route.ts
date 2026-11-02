import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { draftSource, saveLayoutDraftWorkflow } from "../../../../../../workflows/storefront/layout"
import { adminLayout } from "../../../read"

/**
 * POST /admin/storefront-layout/revisions/:revision/restore (adr/0049): an
 * earlier publication back into the draft, checked again (a record it
 * named may be gone); publishing it is a step of its own.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const revision = Number(req.params["revision"])
  if (!Number.isInteger(revision) || revision < 1) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
  }
  const source = await draftSource(req.scope, revision)
  await saveLayoutDraftWorkflow(req.scope).run({ input: source })
  res.json({ layout: await adminLayout(req.scope) })
}
