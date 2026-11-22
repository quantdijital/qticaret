import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setBookableWorkflow } from "../../../../../workflows/booking/admin"
import type { AdminPostBookableType } from "../../../booking-slots/validators"
import { readBookable } from "../../../booking-slots/view"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

/** GET /admin/products/:id/bookable: the product's booking mode and settings (adr/0076 §3). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readBookable(req.scope, idOf(req)))
}

/** POST /admin/products/:id/bookable: a dated product's settings; fields left out keep theirs. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostBookableType>,
  res: MedusaResponse
): Promise<void> {
  await setBookableWorkflow(req.scope).run({
    input: { product_id: idOf(req), settings: req.validatedBody },
  })
  res.json(await readBookable(req.scope, idOf(req)))
}
