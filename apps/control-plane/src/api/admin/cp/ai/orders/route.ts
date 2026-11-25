import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ordersAsStaff } from "../../../../../lib/ai-credits/staff"
import type { GetAiOrdersType } from "../validators"
import { shopsOf } from "../shops"
import { orderView } from "../views"

/**
 * GET /admin/cp/ai/orders (owner; adr/0085 K11): every shop's top-up
 * requests, newest first; `status` narrows them. Each names its shop
 * (`tenant`: name, slug, primary address; P3d).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAiOrdersType>,
  res: MedusaResponse
): Promise<void> {
  const { status, limit, offset } = req.validatedQuery
  const page = await ordersAsStaff(req.scope, { status: status ?? null, limit, offset })
  res.setHeader("Cache-Control", "no-store")
  const shops = await shopsOf(
    req,
    page.rows.map((row) => row.tenant_id)
  )
  res.json({
    orders: page.rows.map((row) => orderView(row, shops.get(row.tenant_id) ?? null)),
    count: page.count,
    limit,
    offset,
  })
}
