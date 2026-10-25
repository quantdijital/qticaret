import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readHomeSummary } from "./read"

/** The home page's order numbers (docs/17); no personal data. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readHomeSummary(req.scope))
}
