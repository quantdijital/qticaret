import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { handleGeliverNotification } from "../../../workflows/shipping/geliver-notification"

// Only what decides which parcel to ask about: the rest of the body is not trusted
const notification = z
  .object({
    event: z.string().max(64),
    data: z.object({ id: z.string().min(1).max(64) }).loose(),
  })
  .loose()

/**
 * Geliver's tracking notifications (adr/0031): `TRACK_UPDATED` with the
 * shipment. Unsigned, so a hint: the parcel is read again from Geliver's
 * API. A failure answers 503 so a retry may come; the job asks anyway.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = notification.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ ok: false })
    return
  }
  if (body.data.event !== "TRACK_UPDATED") {
    res.json({ ok: true })
    return
  }
  const outcome = await handleGeliverNotification(req.scope, body.data.data.id)
  res.status(outcome === "failed" ? 503 : 200).json({ ok: outcome !== "failed" })
}
