import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readRecentOrders } from "./read"

/** The newest orders for the dashboard; a recorded read of personal data (adr/0011). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readRecentOrders(req.scope))
}
