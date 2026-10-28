import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
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

/**
 * POST /admin/return-requests/:id/receive (adr/0032): what reached the
 * warehouse goes back in stock, then its money is given back. A refund
 * that fails leaves the request received, with the reason: "refund" tries
 * it again.
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
  const problem = receivedProblem(
    request.items as unknown as { line_item_id: string; quantity: number }[],
    req.validatedBody.items
  )
  if (problem) {
    throw new ValidationError(problem, { field: "items" })
  }
  await receiveReturnWorkflow(req.scope).run({
    input: { id, staff_id: req.auth_context.actor_id, items: req.validatedBody.items },
  })
  try {
    const refunded = await refundReturn(req.scope, { id, staff_id: req.auth_context.actor_id })
    res.json({ return_request: refunded, refund_error: null })
  } catch (error) {
    logger.warn({ event: "returns.refund_failed", returnRequestId: id, err: errorSummary(error) })
    const key = (error as { safeMessage?: unknown }).safeMessage
    res.json({
      return_request: { ...request, status: "received" },
      refund_error:
        typeof key === "string"
          ? serverErrorMessage(key, "tr")
          : serverErrorMessage("returns.refund_failed", "tr"),
    })
  }
}
