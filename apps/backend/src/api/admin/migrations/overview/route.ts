import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { migrationOverview } from "../../../../workflows/migration/overview"

/**
 * `GET /admin/migrations/overview` (adr/0042 Ek 2026-11-27): what moved by
 * kind, what each completion would take, the old addresses awaiting a
 * decision. The owner's alone, as every migration route.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ overview: await migrationOverview(req.scope) })
}
