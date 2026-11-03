import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"
import { approveExchangeWorkflow } from "../../../../../workflows/returns/approve-exchange"
import { approveReturnWorkflow } from "../../../../../workflows/returns/approve-return"
import { requoteExchange } from "../../../../../workflows/returns/exchange-quote"
import { isGiftReturn } from "../../../../../workflows/returns/gift-lines"
import { withdrawGiftCardsWorkflow } from "../../../../../workflows/returns/withdraw-gift-cards"
import { refundAnswer } from "../../refund-answer"
import type { AdminPostReturnApproveType } from "../../validators"
import { returnRequestDetail } from "../../view"

/**
 * POST /admin/return-requests/:id/approve: Medusa's return and the
 * carrier's return code (adr/0032); for an exchange (§6) Medusa's
 * exchange, at the difference staff were shown: one that changed since is
 * quoted again and refused, for staff to look again. A withdrawal from gift
 * cards (adr/0025, 2026-11-03) has nothing to send back: its cards are
 * voided, the request is received at once and its money given back.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReturnApproveType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  const [request] = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  const input = {
    id,
    staff_id: req.auth_context.actor_id,
    note: req.validatedBody.note ?? null,
  }
  if (request.kind === "exchange") {
    await requoteExchange(req.scope, request)
    const { result } = await approveExchangeWorkflow(req.scope).run({
      input: { ...input, collected: req.validatedBody.difference_collected },
    })
    res.json({ return_request: await returnRequestDetail(req.scope, result) })
    return
  }
  if (await isGiftReturn(req.scope, request)) {
    const { result } = await withdrawGiftCardsWorkflow(req.scope).run({ input })
    res.json(await refundAnswer(req.scope, { id, staff_id: input.staff_id }, result))
    return
  }
  const { result } = await approveReturnWorkflow(req.scope).run({ input })
  res.json({ return_request: await returnRequestDetail(req.scope, result) })
}
