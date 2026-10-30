import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { eraseCustomerWorkflow } from "../../../../../workflows/legal/erase-customer"

/**
 * POST /admin/privacy-requests/:id/erase (F13.5, adr/0041 §6): erases the
 * customer an open erasure request names, and completes it. It cannot be
 * undone: the staff member proves themselves again first.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await eraseCustomerWorkflow(req.scope).run({
    input: { request_id: req.params["id"] ?? "", by: req.auth_context.actor_id },
  })
  res.json({ erased: result })
}
