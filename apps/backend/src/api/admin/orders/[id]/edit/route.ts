import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { serverErrorMessage } from "../../../../../lib/errors/messages"
import { I18N_KEY } from "../../../../../lib/errors/http"
import { liraOf } from "../../../return-requests/view"
import { editOrder } from "../../../../../workflows/orders/edit-order"
import { editInputOf } from "./input"
import type { AdminPostOrderEditType } from "./validators"

/**
 * POST /admin/orders/:id/edit (adr/0033): the order's lines changed at
 * the difference staff saw; what the shop then owes goes back at once. A
 * refund that fails leaves the edit made, with its reason.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderEditType>,
  res: MedusaResponse
): Promise<void> {
  const expected = req.validatedBody.expected_difference
  const result = await editOrder(req.scope, {
    ...editInputOf(req),
    // Signed: kuruş are whole (the validator checked two decimals)
    expected: Math.round(expected * 100),
    collected: req.validatedBody.difference_collected,
    reference: req.validatedBody.reference,
  })
  res.json({
    order_id: req.params["id"],
    // Null when the edit was made before under the same key
    difference: result.difference === null ? null : liraOf(result.difference),
    refund_error:
      result.refund_error === null
        ? null
        : serverErrorMessage(
            I18N_KEY.test(result.refund_error) ? result.refund_error : "orders.refund_failed",
            "tr"
          ),
  })
}
