import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addOrderNoteWorkflow, orderNotes } from "../../../../../workflows/orders/order-notes"
import type { AdminPostOrderNoteType } from "./validators"

/**
 * GET /admin/orders/:id/notes (F12.8): the team's notes on the order,
 * oldest first, with who wrote them and whether the reader may remove each.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({
    notes: await orderNotes(req.scope, req.params["id"] ?? "", req.auth_context.actor_id),
  })
}

/** POST /admin/orders/:id/notes: a note by the signed-in staff member; the shopper never sees it. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderNoteType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await addOrderNoteWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      author_id: req.auth_context.actor_id,
      body: req.validatedBody.body,
    },
  })
  res.status(201).json({ note: { id: result.id } })
}
