import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../lib/logging"
import { sendMessageWorkflow } from "../../../workflows/messaging/send-message"
import type { StorePostOrderLookupType } from "./validators"

/** One link per order in ten minutes, however often it is asked for. */
const BUCKET_MS = 10 * 60 * 1000

/**
 * POST /store/order-lookup (adr/0037 §2): mails the order's link to the
 * address it was placed with, when the number and the address match.
 * The answer is the same either way and comes before any mail is sent,
 * so neither its words nor its timing tell whether such an order exists.
 */
export async function POST(
  req: MedusaRequest<StorePostOrderLookupType>,
  res: MedusaResponse
): Promise<void> {
  const { display_id: displayId, email } = req.validatedBody
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "email"],
    // Typed as text in the filter; the column is a number
    filters: { display_id: String(displayId) },
  })
  const order = (data as { id: string; email: string | null }[]).find(
    (each) => each.email?.trim().toLowerCase() === email
  )
  res.status(202).json({ ok: true })
  if (order) {
    sendMessageWorkflow(req.scope)
      .run({
        input: {
          template: "order.access_link",
          resource_id: order.id,
          key: String(Math.floor(Date.now() / BUCKET_MS)),
        },
      })
      .catch((error: unknown) => {
        logger.warn({ event: "orders.lookup_send_failed", err: errorSummary(error) })
      })
  }
}
