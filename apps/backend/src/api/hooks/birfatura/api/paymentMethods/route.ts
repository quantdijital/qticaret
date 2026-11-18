import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BIRFATURA_PAYMENTS, birfaturaTexts } from "../../../../../lib/invoicing/birfatura"
import { INVOICE_PAYMENTS } from "../../../../../lib/invoicing/types"

/**
 * POST /hooks/birfatura/api/paymentMethods (adr/0072 §5): how an order may
 * be paid, by ids that never change (BirFatura keeps the shop's mapping of
 * them); an order's `PaymentTypeId` is one of these.
 */
export function POST(_req: MedusaRequest, res: MedusaResponse): void {
  const texts = birfaturaTexts().payments
  res.setHeader("Cache-Control", "no-store")
  res.json({
    PaymentMethods: INVOICE_PAYMENTS.map((payment) => ({
      Id: BIRFATURA_PAYMENTS[payment],
      Value: texts[payment],
    })),
  })
}
