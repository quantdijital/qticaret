import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { syncMerchantProductsWorkflow } from "../../../../../workflows/google/merchant"

/** POST /admin/google/merchant/sync: the shop's products sent to Merchant Center now. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await syncMerchantProductsWorkflow(req.scope).run({
    input: { trigger: "panel" },
  })
  res.json({ sync: result })
}
