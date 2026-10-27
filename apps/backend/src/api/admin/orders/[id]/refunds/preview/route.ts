import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../../lib/money"
import { kurusOfLira, previewOrderRefund } from "../../../../../../workflows/orders/refund-preview"
import type { AdminPostOrderRefundPreviewType } from "../validators"

/** What the refund would give back, line by line, as exact lira; nothing is changed. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderRefundPreviewType>,
  res: MedusaResponse
): Promise<void> {
  const { items, shipping, amount } = req.validatedBody
  const plan = await previewOrderRefund(req.scope, req.params["id"] ?? "", {
    ...(items ? { items } : {}),
    ...(shipping ? { shipping } : {}),
    ...(amount !== undefined ? { amount: kurusOfLira(amount) } : {}),
  })
  res.json({
    refund: {
      amount: toMedusaAmount(plan.total),
      refundable: toMedusaAmount(plan.refundable),
      lines: plan.lines.map((line) => ({ ...line, net: toMedusaAmount(line.net) })),
    },
  })
}
