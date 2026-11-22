import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createBookingSlotsWorkflow } from "../../../../../workflows/booking/admin"
import type {
  AdminGetBookingSlotsType,
  AdminPostBookingSlotsType,
} from "../../../booking-slots/validators"
import { readProductSlots, readSlots } from "../../../booking-slots/view"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

/** GET /admin/products/:id/booking-slots: the departures by start, with their places. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { from, limit } = req.validatedQuery as AdminGetBookingSlotsType
  res.json({ slots: await readProductSlots(req.scope, idOf(req), { from, limit }) })
}

/** POST /admin/products/:id/booking-slots: new departures, their places all free. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostBookingSlotsType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createBookingSlotsWorkflow(req.scope).run({
    input: { product_id: idOf(req), slots: req.validatedBody.slots },
  })
  res.json({ slots: await readSlots(req.scope, result) })
}
