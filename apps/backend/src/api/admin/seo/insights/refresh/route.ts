import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { collectSeoInsightsWorkflow } from "../../../../../workflows/seo/insights"

/** POST /admin/seo/insights/refresh: Search Console and CrUX asked now, from the panel. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await collectSeoInsightsWorkflow(req.scope).run({
    input: { now: new Date().toISOString() },
  })
  res.json(result)
}
