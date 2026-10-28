import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { generateFeedsWorkflow } from "../../../../workflows/marketing/feeds"

/** POST /admin/marketing-feeds/generate: the feeds built again now, from the panel. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await generateFeedsWorkflow(req.scope).run({ input: { trigger: "panel" } })
  res.json({ generated: result.generated, items: result.items })
}
