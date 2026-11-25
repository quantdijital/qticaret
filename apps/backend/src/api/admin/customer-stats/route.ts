import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readCustomerStats } from "./read"
import type { AdminGetCustomerStatsType } from "./validators"

/**
 * `GET /admin/customer-stats?ids=` (CU1, O4): each customer's orders, what
 * they came to, the average basket, the last order and the city, counted
 * as the sales report counts sales. A recorded read (the city).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetCustomerStatsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readCustomerStats(req.scope, req.validatedQuery.ids))
}
