import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readCollection } from "../read"

/** GET /admin/collection-board/:id: one collection as the panel's page shows it. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ collection: await readCollection(req.scope, req.params["id"] ?? "") })
}
