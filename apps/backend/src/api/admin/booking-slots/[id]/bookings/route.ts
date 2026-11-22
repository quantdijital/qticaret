import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readSlotBookings } from "../../bookings-view"

/**
 * GET /admin/booking-slots/:id/bookings: a departure's bookings, newest
 * first, with their order's number; no person's details (adr/0076 §9, D4).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ bookings: await readSlotBookings(req.scope, req.params["id"] ?? "") })
}
