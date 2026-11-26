import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { shippingClassUsage } from "../../../../workflows/shipping/class-usage"

/**
 * GET /admin/shipping-setup/classes (adr/0087 §4): how many products are
 * in each shipping class, `free` included, for Settings > Shipping's
 * classes card ("12 ürün Standart'a döner").
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ usage: await shippingClassUsage(req.scope) })
}
