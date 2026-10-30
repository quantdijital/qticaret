import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeOrderNoteWorkflow } from "../../../../../../workflows/orders/order-notes"

/** DELETE /admin/orders/:id/notes/:note_id (F12.8): its author's own, or any for the owner. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const noteId = req.params["note_id"] ?? ""
  await removeOrderNoteWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      note_id: noteId,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.json({ id: noteId, object: "order_note", deleted: true })
}
