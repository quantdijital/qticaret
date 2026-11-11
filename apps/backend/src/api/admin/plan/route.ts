import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPlanSummary } from "../../../lib/plan-limits"

/**
 * GET /admin/plan (adr/0061 §5.6, Ek C14): the package, each limit with
 * what the shop uses, the billing summary the signed plan document gives
 * and the payment instruction. Read only; unmanaged, `managed: false` and
 * no limits.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ plan: await readPlanSummary(req.scope) })
}
