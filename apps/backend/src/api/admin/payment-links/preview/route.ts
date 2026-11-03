import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewPaymentLinkWorkflow } from "../../../../workflows/payment-links/create"
import type { AdminPreviewPaymentLinkType } from "../validators"

/**
 * POST /admin/payment-links/preview (adr/0051 §2): the new-order form's
 * summary as the backend works it out: the lines at the catalog's prices,
 * the discount within the role's limit, the preset option's shipping for
 * the address (`shipping_estimate: "at_checkout"` and no figure when only
 * a cart can price it), the total with it, and the lines short on the
 * shelf. Nothing is written.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPreviewPaymentLinkType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await previewPaymentLinkWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      customer_id: body.customer_id ?? null,
      lines: body.lines,
      discount: body.discount ?? null,
      shipping_option_id: body.shipping_option_id ?? null,
      with_address: Boolean(body.address),
    },
  })
  res.json({
    preview: {
      lines: result.lines.map((line) => ({ ...line, total: line.unit_price * line.quantity })),
      items_total: result.items_total,
      discount: result.discount,
      shipping_total: result.shipping_total,
      shipping_estimate: result.shipping_estimate,
      total: result.total,
      short_variant_ids: result.short_variant_ids,
      currency_code: "try",
    },
  })
}
