import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readLandingFacets } from "../read"

/** `GET /admin/landings/facets` (F3.16): what a landing page can narrow its category by. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readLandingFacets(req.scope))
}
