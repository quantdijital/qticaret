import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { discountPriceListWorkflow } from "../../../../../workflows/pricing/discount-price-list"
import type { AdminPostPriceListDiscountType } from "./validators"

/** `POST /admin/price-lists/:id/discount` (F4.1): the products at their own price less a percentage. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPriceListDiscountType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await discountPriceListWorkflow(req.scope).run({
    input: {
      price_list_id: req.params["id"] ?? "",
      product_ids: req.validatedBody.product_ids,
      rate_bps: Math.round(req.validatedBody.percent * 100),
    },
  })
  res.json(result)
}
