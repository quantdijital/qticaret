import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeContentEntry } from "../read"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ entry: await storeContentEntry(req.scope, req.params["id"] ?? "") })
}
