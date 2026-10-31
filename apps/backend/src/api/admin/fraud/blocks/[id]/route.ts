import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeBlockWorkflow } from "../../../../../workflows/fraud/blocks"

/** DELETE /admin/fraud/blocks/:id (adr/0044 §4): the entry stops nothing from now on. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await removeBlockWorkflow(req.scope).run({ input: { id } })
  res.json({ id, deleted: true })
}
