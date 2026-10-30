import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { globalSearch } from "../../../workflows/search/global-search"
import type { AdminGetGlobalSearchType } from "./validators"

/**
 * GET /admin/global-search?q= (F12.9): what the panel's search box finds,
 * a few of each: orders, customers, products and parcels. Customers'
 * names, so a recorded read.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetGlobalSearchType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await globalSearch(req.scope, req.validatedQuery.q))
}
