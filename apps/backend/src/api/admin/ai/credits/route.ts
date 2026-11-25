import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiCreditsView } from "../../../../workflows/ai/credits-view"

/**
 * GET /admin/ai/credits (adr/0085 §3, §4): the platform's credits for the
 * panel's card: the month's grant and bought credits left, the day's cap,
 * each task's credits, the top-up packs and the open request. Only
 * `{ available: false }` while the flag is off or the credits cannot be
 * used. Owner and admin only (`permission-rules.ts`); the status is the
 * one kept 60 seconds, never asked afresh from here.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(await aiCreditsView(req.scope))
}
