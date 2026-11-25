import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestAiCreditOrderWorkflow } from "../../../../../workflows/ai/request-credit-order"
import { AUDIT_RESOURCE_ID, AUDIT_RESULT } from "../../../../http/audit/notes"
import type { AdminPostAiCreditOrderType } from "../../validators"

/**
 * POST /admin/ai/credits/orders (adr/0085 §3, K11): "Kredi yükle", a
 * request for one of the platform's packs; staff mark it paid once paid.
 * The body is `{ pack_id }` alone: credits, an amount or a currency are
 * refused (the pack's are the platform's). The owner's alone
 * (`permission-rules.ts`); no such route while `ai.platform_credits` is
 * off. The audit entry names the pack and the request.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiCreditOrderType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await requestAiCreditOrderWorkflow(req.scope).run({
    input: { pack_id: req.validatedBody.pack_id, user_id: req.auth_context.actor_id },
  })
  res.locals[AUDIT_RESOURCE_ID] = result.id
  res.locals[AUDIT_RESULT] = { pack_id: result.pack_id }
  res.status(201).json({ order: result })
}
