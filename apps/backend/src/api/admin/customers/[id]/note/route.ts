import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  customerNote,
  saveCustomerNoteWorkflow,
} from "../../../../../workflows/customers/customer-note"
import type { AdminPostCustomerNoteType } from "./validators"

/** GET /admin/customers/:id/note (2026-11-06): the team's note on the customer. A recorded read. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ note: await customerNote(req.scope, req.params["id"] ?? "") })
}

/**
 * POST /admin/customers/:id/note: the note written, changed or (empty)
 * removed by the signed-in staff member; the customer never sees it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCustomerNoteType>,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.params["id"] ?? ""
  await saveCustomerNoteWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      body: req.validatedBody.body,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.json({ note: await customerNote(req.scope, customerId) })
}
