import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readDashboardTasks } from "./read"

/** Counts of what waits for the shop (no personal data). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readDashboardTasks(req.scope))
}
