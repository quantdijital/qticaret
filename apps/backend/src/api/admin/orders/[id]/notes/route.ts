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

/**
 * POST /admin/orders/:id/notes: a note by the signed-in staff member; the
 * shopper sees it only when `notify_customer` e-mails it to them (Batch 9 /
 * O3). `sent` says how that send went: `sent`, or why not (`template_off`
 * when the shop turned the message off, `not_sent` without an address).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderNoteType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await addOrderNoteWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      author_id: req.auth_context.actor_id,
      body: req.validatedBody.body,
      notify_customer: req.validatedBody.notify_customer === true,
    },
  })
  res.status(201).json({ note: { id: result.id }, sent: result.sent })
}
