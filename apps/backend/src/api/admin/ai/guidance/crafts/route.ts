import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { defaultCrafts } from "../../../../../lib/ai/instructions"

/**
 * GET /admin/ai/guidance/crafts (adr/0074 §3): every text task's default
 * craft, its version and what is always added around it (the data rule
 * first, the fixed rules last), so the panel fills the "Gelişmiş" editor
 * with the default, says what the owner's text can never take away, and
 * warns when the default moved past the version an owner's craft was
 * written against. Written in code only; no shop data. Owner and admin
 * (`permission-rules.ts`, `/admin/ai/guidance*`).
 */
export function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  res.json({ crafts: defaultCrafts() })
}
