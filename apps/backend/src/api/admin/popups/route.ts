import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPopupDetail, readPopups } from "../../../workflows/popups/reads"
import { createPopupWorkflow } from "../../../workflows/popups/workflows"
import type { PopupChanges } from "../../../workflows/popups/workflows"
import type { AdminGetPopupsType, AdminPostPopupType } from "./validators"

/** `GET /admin/popups` (adr/0080): the pop-ups, newest first, each with its state and counts. */
export async function GET(
  req: MedusaRequest<unknown, AdminGetPopupsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readPopups(req.scope, req.validatedQuery))
}

/** `POST /admin/popups`: a new pop-up, off until it is switched on. */
export async function POST(
  req: MedusaRequest<AdminPostPopupType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createPopupWorkflow(req.scope).run({
    input: { values: req.validatedBody as PopupChanges },
  })
  res.status(201).json({ popup: await readPopupDetail(req.scope, result.id) })
}
