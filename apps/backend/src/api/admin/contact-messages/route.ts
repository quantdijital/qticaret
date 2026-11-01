import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTACT_MESSAGES_MODULE } from "../../../modules/contact-messages"
import type ContactMessagesModuleService from "../../../modules/contact-messages/service"
import type { AdminGetContactMessagesType } from "./validators"

/**
 * GET /admin/contact-messages (adr/0047): the contact form's messages,
 * waiting ones by default, newest first, opened for the panel.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetContactMessagesType>,
  res: MedusaResponse
): Promise<void> {
  const { status, offset, limit } = req.validatedQuery
  const messages = req.scope.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  const [rows, count] = await messages.listAndCountContactMessages(
    { status },
    { skip: offset, take: limit, order: { created_at: status === "new" ? "ASC" : "DESC" } }
  )
  res.json({
    contact_messages: rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      order_number: row.order_number,
      customer_id: row.customer_id,
      status: row.status,
      handled_by: row.handled_by,
      handled_at: row.handled_at,
      created_at: row.created_at,
      ...messages.open(row.sealed),
    })),
    count,
    offset,
    limit,
  })
}
