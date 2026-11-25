import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ordersAsStaff } from "../../../../../lib/ai-credits/staff"
import type { GetAiOrdersType } from "../validators"
import { orderView } from "../views"

/**
 * GET /admin/cp/ai/orders (owner; adr/0085 K11): every shop's top-up
 * requests, newest first; `status` narrows them.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAiOrdersType>,
  res: MedusaResponse
): Promise<void> {
  const { status, limit, offset } = req.validatedQuery
  const page = await ordersAsStaff(req.scope, { status: status ?? null, limit, offset })
  res.setHeader("Cache-Control", "no-store")
  res.json({ orders: page.rows.map(orderView), count: page.count, limit, offset })
}
