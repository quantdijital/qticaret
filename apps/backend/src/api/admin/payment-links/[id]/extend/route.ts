import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { extendPaymentLinkWorkflow, linkById } from "../../../../../workflows/payment-links/manage"
import { linkSummaries } from "../../../../../workflows/payment-links/views"
import type { AdminExtendPaymentLinkType } from "../../validators"

/**
 * POST /admin/payment-links/:id/extend: an open link's end `hours` from
 * now, never past seven days from its making (its token's own end); the
 * same link and text stay good. Owner and admin.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminExtendPaymentLinkType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await extendPaymentLinkWorkflow(req.scope).run({
    input: { id, hours: req.validatedBody.hours },
  })
  res.json({
    payment_link: (await linkSummaries(req.scope, [await linkById(req.scope, id)]))[0],
  })
}
