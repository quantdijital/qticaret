import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readStockBoard } from "./read"
import type { AdminGetStockBoardType } from "./validators"

/** The panel's stock list by view (no personal data). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetStockBoardType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readStockBoard(req.scope, req.validatedQuery))
}
