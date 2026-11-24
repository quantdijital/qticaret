import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPopupDetail } from "../../../../workflows/popups/reads"
import { deletePopupWorkflow, updatePopupWorkflow } from "../../../../workflows/popups/workflows"
import type { PopupChanges } from "../../../../workflows/popups/workflows"
import type { AdminUpdatePopupType } from "../validators"

/** `GET /admin/popups/:id`: every field, its state, its counts and its last 30 days. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ popup: await readPopupDetail(req.scope, req.params["id"] ?? "") })
}

/** `POST /admin/popups/:id`: fields left out keep their values. */
export async function POST(
  req: MedusaRequest<AdminUpdatePopupType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await updatePopupWorkflow(req.scope).run({
    input: { id, values: req.validatedBody as PopupChanges },
  })
  res.json({ popup: await readPopupDetail(req.scope, id) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deletePopupWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "popup", deleted: true })
}
