import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readProductBoard } from "./read"
import type { AdminGetProductBoardType } from "./validators"

/**
 * GET /admin/product-board (adr/0022): the panel's product list, filtered
 * and ordered as Medusa's own list cannot (brand, stock, what is missing,
 * price and stock orders), as the page's ids; no personal data.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetProductBoardType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readProductBoard(req.scope, req.validatedQuery))
}
