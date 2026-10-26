import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeLanding } from "../read"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ landing: await storeLanding(req.scope, req.params["id"] ?? "") })
}
