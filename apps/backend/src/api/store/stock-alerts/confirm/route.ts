import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { confirmStockAlertByLinkWorkflow } from "../../../../workflows/messaging/email-links"
import type { StorePostStockAlertConfirmType } from "./validators"

/**
 * POST /store/stock-alerts/confirm (F10.5, adr/0038 Ek 2026-11-02): the
 * storefront's `/stok-bildirimi/onay` page, once its reader pressed the
 * button. Turns the guest's alert on; a used, late or unknown link does
 * nothing.
 */
export async function POST(
  req: MedusaRequest<StorePostStockAlertConfirmType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await confirmStockAlertByLinkWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  })
  if (!result) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "stock_alerts.link_invalid")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ status: result.status })
}
