import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { customerMessageViews } from "../../../../workflows/messaging/template-texts"

/**
 * GET /admin/messaging/customer-messages (adr/0036 Ek 2026-11-10): every
 * message the shop's customers get, by group, each field's platform text
 * beside the shop's own, its `{belirteç}`s and whether it goes.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ messages: await customerMessageViews(req.scope) })
}
