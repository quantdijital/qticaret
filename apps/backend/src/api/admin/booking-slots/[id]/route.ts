import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateBookingSlotWorkflow } from "../../../../workflows/booking/admin"
import type { AdminPostBookingSlotType } from "../validators"
import { readSlots } from "../view"

/**
 * POST /admin/booking-slots/:id: a departure's capacity, state, dates or
 * price differences (adr/0076 §9); a capacity below the places sold and
 * held is refused.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostBookingSlotType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await updateBookingSlotWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", changes: req.validatedBody },
  })
  const [slot] = await readSlots(req.scope, [result])
  res.json({ slot })
}
