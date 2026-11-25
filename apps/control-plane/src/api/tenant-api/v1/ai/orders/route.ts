import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiCreditOrderRequestSchema } from "@qticaret/types/control-plane"
import { requestTopUp } from "../../../../../lib/ai-gateway/tenant"
import { answeringAiConflicts } from "../../../../http/ai-conflicts"
import { tenantCallerOf } from "../../../../http/tenant-api"

/**
 * POST /tenant-api/v1/ai/orders (a shop, signed; adr/0085 K11): a top-up
 * request for one of the packs offered. The body is `{ pack_id,
 * requested_by }` and nothing else (strict: credits or an amount sent are
 * refused); the pack's credits and price are the platform's. The shop is
 * the signature's; `requested_by` is its user's opaque id, never an e-mail.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  res.setHeader("Cache-Control", "no-store")
  if (!caller) {
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const body = aiCreditOrderRequestSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ type: "invalid_data", message: "errors.invalid_request" })
    return
  }
  const order = await answeringAiConflicts(res, () =>
    requestTopUp(req.scope, {
      tenantId: caller.tenantId,
      packId: body.data.pack_id,
      requestedBy: body.data.requested_by,
      now: new Date(),
    })
  )
  if (order === undefined) {
    return
  }
  res.status(201).json({ order })
}
