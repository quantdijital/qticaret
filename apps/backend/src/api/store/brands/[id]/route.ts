import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { activeBrand, storeBrand } from "../read"

/** `GET /store/brands/:id`: an active brand (F3.11); its page's SEO comes from resolve. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ brand: storeBrand(await activeBrand(req.scope, req.params["id"] ?? "")) })
}
