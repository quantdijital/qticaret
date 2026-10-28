import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"

/**
 * DELETE /admin/messaging/suppressions/:id: takes an address off the list
 * (the customer fixed the mailbox); who did it is kept on the row and the
 * audit log has the request.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const [row] = await messaging.listMessageSuppressions({ id }, { take: 1, select: ["id"] })
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.suppression_unknown")
  }
  await messaging.unsuppress(id, req.auth_context.actor_id || "unknown")
  res.json({ id, deleted: true })
}
