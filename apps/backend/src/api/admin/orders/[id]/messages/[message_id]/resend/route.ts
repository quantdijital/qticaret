import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resendOrderMessageWorkflow } from "../../../../../../../workflows/messaging/resend"

/**
 * POST /admin/orders/:id/messages/:message_id/resend (2026-11-06): "Mesajı
 * yeniden gönder", the order's message again from its template, to the
 * order's current address on its channel; once in ten minutes. What it came
 * to: `sent`, `suppressed`, `channel_off`, `over_quota`, `unavailable`...
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await resendOrderMessageWorkflow(req.scope).run({
    input: { order_id: req.params["id"] ?? "", message_id: req.params["message_id"] ?? "" },
  })
  res.json(result)
}
