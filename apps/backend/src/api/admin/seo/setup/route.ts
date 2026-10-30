import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { seoSetupChecklist } from "../../../../workflows/seo/setup-checklist"

/**
 * GET /admin/seo/setup (F12.10): the SEO setup checklist, each item done
 * or not and what holds an open one. Read from the shop's settings.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ items: await seoSetupChecklist(req.scope) })
}
