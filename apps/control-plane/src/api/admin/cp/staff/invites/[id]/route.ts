import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteInvitesWorkflow } from "@medusajs/medusa/core-flows"

/** DELETE /admin/cp/staff/invites/:id (owner): the invitation withdrawn; its link stops working. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  await deleteInvitesWorkflow(req.scope).run({ input: { ids: [id] } })
  res.json({ id, deleted: true })
}
