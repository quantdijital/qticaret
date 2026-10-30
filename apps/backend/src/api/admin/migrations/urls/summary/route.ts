import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { urlSummary } from "../../../../../workflows/migration/urls-read"

/** `GET /admin/migrations/urls/summary` (F14.7, KK3): the inventory's counts and whether cutover is ready. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ summary: await urlSummary(req.scope) })
}
