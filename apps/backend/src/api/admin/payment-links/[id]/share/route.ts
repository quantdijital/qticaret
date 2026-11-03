import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { linkById } from "../../../../../workflows/payment-links/manage"
import { linkShare } from "../../../../../workflows/payment-links/share"

/**
 * GET /admin/payment-links/:id/share (adr/0051 §7): the link, the SMS and
 * WhatsApp text (no name, no address), the WhatsApp address with the
 * customer's mobile, and which channels it already went out on. Null
 * texts once the link no longer opens. A recorded read: it holds the phone.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const link = await linkById(req.scope, req.params["id"] ?? "")
  res.json({
    share: await linkShare(req.scope, link),
  })
}
