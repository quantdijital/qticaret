import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"
import { approveExchangeWorkflow } from "../../../../../workflows/returns/approve-exchange"
import { approveReturnWorkflow } from "../../../../../workflows/returns/approve-return"
import { requoteExchange } from "../../../../../workflows/returns/exchange-quote"
import type { AdminPostReturnApproveType } from "../../validators"
import { returnRequestView } from "../../view"

/**
 * POST /admin/return-requests/:id/approve: Medusa's return and the
 * carrier's return code (adr/0032); for an exchange (§6) Medusa's
 * exchange, at the difference staff were shown: one that changed since is
 * quoted again and refused, for staff to look again.
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
    res.json({ return_request: returnRequestView(result) })
    return
  }
  const { result } = await approveReturnWorkflow(req.scope).run({ input })
  res.json({ return_request: returnRequestView(result) })
}
