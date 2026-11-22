import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http"
import { receiveBookingRequestWorkflow } from "../../../workflows/contact/booking-request"
import type { StorePostBookingRequestType } from "./validators"

/**
 * POST /store/booking-requests (adr/0076 Ek 2026-11-23): a dated product's
 * call-me request. No payment, no places taken: kept sealed as a contact
 * message for the shop to call back. Behind `catalog.booking`. The answer
 * says only that it came.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostBookingRequestType>,
  res: MedusaResponse
): Promise<void> {
  // A guest has no auth context at all
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  const customerId = auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null
  const body = req.validatedBody
  await receiveBookingRequestWorkflow(req.scope).run({
    input: {
      product_id: body.product_id,
      name: body.name,
      phone: body.phone,
      email: body.email,
      slot_id: body.slot_id,
      date: body.date,
      month: body.month,
      adults: body.adults,
      children: body.children,
      note: body.note,
      customer_id: customerId,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    },
  })
  res.status(202).json({ status: "received" })
}
