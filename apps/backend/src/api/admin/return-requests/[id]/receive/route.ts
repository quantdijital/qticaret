import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
import { I18N_KEY } from "../../../../../lib/errors/http"
import { serverErrorMessage } from "../../../../../lib/errors/messages"
import { errorSummary, logger } from "../../../../../lib/logging"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"
import {
  receiveReturnWorkflow,
  receivedProblem,
  refundReturn,
} from "../../../../../workflows/returns/receive-return"
import type { AdminPostReturnReceiveType } from "../../validators"
import { returnRequestView } from "../../view"

/**
 * POST /admin/return-requests/:id/receive (adr/0032): what reached the
 * warehouse goes back in stock (the damaged part does not), then its money
 * is given back. A refund that fails leaves the request received, with
 * the reason: "refund" tries it again. An exchange (adr/0032 §6) gives
 * back only what the shop owes on the swap, and no shipping.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReturnReceiveType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  const [request] = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "returns.unknown")
  }
  const { items, damaged, refund_shipping } = req.validatedBody
  const problem = receivedProblem(
    request.items as unknown as { line_item_id: string; quantity: number }[],
    items,
    damaged
  )
  if (problem) {
    throw new ValidationError(problem, { field: "items" })
  }
  const exchange = request.kind === "exchange"
  const { result: received } = await receiveReturnWorkflow(req.scope).run({
    input: {
      id,
      staff_id: req.auth_context.actor_id,
      items,
      damaged,
      refund_shipping: refund_shipping && !exchange,
    },
  })
  if (exchange && (request.difference ?? 0) >= 0) {
    res.json({ return_request: returnRequestView(received), refund_error: null })
    return
  }
  try {
    const refunded = await refundReturn(req.scope, { id, staff_id: req.auth_context.actor_id })
    res.json({ return_request: returnRequestView(refunded), refund_error: null })
  } catch (error) {
    logger.warn({ event: "returns.refund_failed", returnRequestId: id, err: errorSummary(error) })
    const key = (error as { safeMessage?: unknown }).safeMessage
    res.json({
      return_request: returnRequestView({ ...request, status: "received" }),
      refund_error:
        typeof key === "string" && I18N_KEY.test(key)
          ? serverErrorMessage(key, "tr")
          : serverErrorMessage("returns.refund_failed", "tr"),
    })
  }
}
