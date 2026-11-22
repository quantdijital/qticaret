import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"
import { CONTACT_MESSAGES_MODULE } from "../../../modules/contact-messages"
import type ContactMessagesModuleService from "../../../modules/contact-messages/service"
import type { AdminGetContactMessagesType } from "./validators"

/**
 * GET /admin/contact-messages (adr/0047): the contact form's messages,
 * waiting ones by default, newest first, opened for the panel; one
 * subject when asked. A booking request names its product's title
 * (adr/0076 Ek 2026-11-23).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetContactMessagesType>,
  res: MedusaResponse
): Promise<void> {
  const { status, subject, phone, offset, limit } = req.validatedQuery
  const messages = req.scope.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  // A phone that is not a Turkish number finds nothing (no hash to match)
  const phoneHash = phone === undefined ? undefined : (messages.phoneHashOf(phone) ?? "-")
  const [rows, count] = await messages.listAndCountContactMessages(
    {
      status,
      ...(subject ? { subject } : {}),
      ...(phoneHash ? { phone_hash: phoneHash } : {}),
    },
    { skip: offset, take: limit, order: { created_at: status === "new" ? "ASC" : "DESC" } }
  )
  const productIds = [...new Set(rows.flatMap((row) => (row.product_id ? [row.product_id] : [])))]
  const { data: products } = productIds.length
    ? await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "title"],
        filters: { id: productIds },
      })
    : { data: [] }
  const titles = new Map(
    (products as { id: string; title?: string | null }[]).map((product) => [
      product.id,
      product.title ?? null,
    ])
  )
  const slotIds = rows.flatMap((row) => {
    const slot = (row.details as { slot_id?: unknown } | null)?.slot_id
    return typeof slot === "string" ? [slot] : []
  })
  const slots = slotIds.length
    ? await req.scope
        .resolve<BookingModuleService>(BOOKING_MODULE)
        .listBookingSlots({ id: slotIds }, { select: ["id", "starts_at"], take: slotIds.length })
    : []
  const startsAt = new Map(slots.map((slot) => [slot.id, new Date(slot.starts_at).toISOString()]))
  res.json({
    contact_messages: rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      order_number: row.order_number,
      product_id: row.product_id,
      product_title: row.product_id ? (titles.get(row.product_id) ?? null) : null,
      details: row.details,
      // The departure asked for, when it still exists
      slot_starts_at:
        startsAt.get((row.details as { slot_id?: string } | null)?.slot_id ?? "") ?? null,
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
