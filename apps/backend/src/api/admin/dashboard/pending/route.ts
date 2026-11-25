import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffRoleOf } from "../../../http/staff-guard"
import { readPendingCounts } from "./read"

/** Counts of what waits in the badged lists (no personal data), for the menu and the dashboard. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readPendingCounts(req.scope, (await staffRoleOf(req)) ?? null))
}
