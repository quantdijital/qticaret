import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  previewDepartureCancel,
  startDepartureCancel,
} from "../../../../../workflows/booking/departure-cancel"

/**
 * GET /admin/booking-slots/:id/cancel (adr/0076 §8, Ek D7a): what
 * cancelling the departure would touch (bookings, orders, places) and
 * give back in all, every booking's departure in full; read only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ preview: await previewDepartureCancel(req.scope, req.params["id"] ?? "") })
}

/**
 * POST /admin/booking-slots/:id/cancel: the departure cancelled now (no
 * more sales), its bookings refunded in full and cancelled after the
 * answer (`booking.departure_cancelled`; the reconcile job carries on
 * what is left). Answers with the counts only (review D3). Asked again:
 * the same, nothing given back twice.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ departure: await startDepartureCancel(req.scope, req.params["id"] ?? "") })
}
