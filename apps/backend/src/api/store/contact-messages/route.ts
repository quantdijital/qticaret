import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { receiveContactMessageWorkflow } from "../../../workflows/contact/messages"
import type { StorePostContactMessageType } from "./validators"

/**
 * POST /store/contact-messages (F18 D10, adr/0047): a message from the
 * storefront's contact form, kept sealed for the shop to answer from the
 * panel. A signed-in customer's is tied to their account. The answer says
 * only that it came.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostContactMessageType>,
  res: MedusaResponse
): Promise<void> {
  // A guest has no auth context at all
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  const customerId = auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null
  await receiveContactMessageWorkflow(req.scope).run({
    input: { ...req.validatedBody, customer_id: customerId },
  })
  res.status(202).json({ status: "received" })
}
