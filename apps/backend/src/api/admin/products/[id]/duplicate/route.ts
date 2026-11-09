import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { duplicateProductWorkflow } from "../../../../../workflows/catalog/duplicate/workflow"

/**
 * POST /admin/products/:id/duplicate (owner 2026-11-06, "Kopyala"): the
 * product copied as a draft named "… (kopya)" on a free address, its codes
 * and stock left empty; the panel opens the copy. Recorded in the audit
 * log as every admin write, under the product copied.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await duplicateProductWorkflow(req.scope).run({
    input: { product_id: req.params["id"] ?? "" },
  })
  res.status(201).json({ product: result })
}
