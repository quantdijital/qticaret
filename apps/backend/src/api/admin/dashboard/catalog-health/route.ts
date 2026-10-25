import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readCatalogHealth } from "./read"

/** How complete the catalog is: counts of products missing images, categories and more. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readCatalogHealth(req.scope))
}
