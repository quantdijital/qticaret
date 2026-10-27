import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import type { Kurus } from "../../../../../lib/money"
import { kurusOfLira } from "../../../../../workflows/orders/refund-preview"
import { refundOrderWorkflow } from "../../../../../workflows/orders/refund-order"
import type { AdminPostOrderRefundType } from "./validators"

/**
 * Gives money back on the order (F5 V5): units of its lines, its shipping,
 * or a free amount. The amount is worked out on the server; the request's
 * `reference` makes a retried refund happen once.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderRefundType>,
  res: MedusaResponse
): Promise<void> {
  const { items, shipping, amount, reference, note } = req.validatedBody
  const { result } = await refundOrderWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      reference,
      request: {
        ...(items ? { items } : {}),
        ...(shipping ? { shipping } : {}),
        ...(amount !== undefined ? { amount: kurusOfLira(amount) } : {}),
      },
      note: note ?? null,
      created_by: req.auth_context.actor_id || null,
    },
  })
  res.json({
    refund: {
      reference: result.reference,
      amount: toMedusaAmount(result.amount as Kurus),
      made_before: result.made_before,
      lines: result.lines.map((line) => ({ ...line, net: toMedusaAmount(line.net) })),
    },
  })
}
