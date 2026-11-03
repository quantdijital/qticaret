import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPaymentLinkWorkflow } from "../../../../../workflows/payment-links/send"
import type { AdminResendPaymentLinkType } from "../../validators"

/**
 * POST /admin/payment-links/:id/resend (adr/0051 §7): "SMS gönder",
 * "E-posta gönder": the link to its customer on the channels asked for,
 * once in ten minutes. What each channel came to: `sent`, `channel_off`
 * (no SMS account), `invalid_recipient` (no phone), `over_quota`...
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminResendPaymentLinkType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await sendPaymentLinkWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", channels: req.validatedBody.channels },
  })
  res.json({ outcomes: result })
}
