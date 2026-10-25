import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readOrderBoard } from "./read"
import type { AdminGetOrderBoardType } from "./validators"

/** The panel's order list by stage; a recorded read of personal data (adr/0011). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetOrderBoardType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readOrderBoard(req.scope, req.validatedQuery))
}
