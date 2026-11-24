import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPopupDetail } from "../../../../../workflows/popups/reads"
import { setPopupActiveWorkflow } from "../../../../../workflows/popups/workflows"
import type { AdminPostPopupStatusType } from "../../validators"

/** `POST /admin/popups/:id/status`: the list's switch, `{ is_active }`. */
export async function POST(
  req: MedusaRequest<AdminPostPopupStatusType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await setPopupActiveWorkflow(req.scope).run({
    input: { id, is_active: req.validatedBody.is_active },
  })
  res.json({ popup: await readPopupDetail(req.scope, id) })
}
