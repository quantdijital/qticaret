import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteContactMessageWorkflow,
  markContactMessageWorkflow,
} from "../../../../workflows/contact/messages"
import type { AdminPostContactMessageType } from "../validators"

/** POST /admin/contact-messages/:id: answered, or back to waiting (adr/0047). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostContactMessageType>,
  res: MedusaResponse
): Promise<void> {
  await markContactMessageWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      status: req.validatedBody.status,
      by: req.auth_context.actor_id,
    },
  })
  res.json({ id: req.params["id"], status: req.validatedBody.status })
}

/** DELETE /admin/contact-messages/:id: spam, or done with (adr/0047). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await deleteContactMessageWorkflow(req.scope).run({ input: { id: req.params["id"] ?? "" } })
  res.json({ id: req.params["id"], deleted: true })
}
