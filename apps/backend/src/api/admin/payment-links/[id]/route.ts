import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { linkById } from "../../../../workflows/payment-links/manage"
import { linkDetail } from "../../../../workflows/payment-links/views"

/** GET /admin/payment-links/:id (adr/0051 §13): the link with its customer in full; a recorded read. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const link = await linkById(req.scope, req.params["id"] ?? "")
  res.json({ payment_link: linkDetail(req.scope, link) })
}
