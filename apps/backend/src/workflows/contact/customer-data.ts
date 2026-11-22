import type { MedusaContainer } from "@medusajs/framework/types"
import { CONTACT_MESSAGES_MODULE } from "../../modules/contact-messages"
import type ContactMessagesModuleService from "../../modules/contact-messages/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A person's contact messages: by their account, or by an address or a
 * phone of theirs (a guest's; a booking request may carry a phone only,
 * adr/0076 Ek 2026-11-23). `addresses` mixes e-mails and phones.
 */
async function messagesOf(container: Container, customerId: string, addresses: string[]) {
  const messages = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  const emails = addresses.filter((address) => address.includes("@"))
  const hashes = emails.flatMap((address) => messages.emailHashOf(address) ?? [])
  const phones = [
    ...new Set(
      addresses
        .filter((address) => !address.includes("@"))
        .flatMap((phone) => messages.phoneHashOf(phone) ?? [])
    ),
  ]
  const rows = await messages.listContactMessages(
    {
      $or: [
        { customer_id: customerId },
        ...(hashes.length ? [{ email_hash: hashes }] : []),
        ...(phones.length ? [{ phone_hash: phones }] : []),
      ],
    },
    {
      select: [
        "id",
        "subject",
        "order_number",
        "product_id",
        "details",
        "status",
        "sealed",
        "created_at",
      ],
      take: null,
    }
  )
  return { messages, rows }
}

/** For a KVKK copy (adr/0041 §6): what they wrote, opened. */
export async function contactMessagesFor(
  container: Container,
  customerId: string,
  addresses: string[]
) {
  const { messages, rows } = await messagesOf(container, customerId, addresses)
  return rows.map((row) => ({
    konu: row.subject,
    sipariş_no: row.order_number,
    // A booking request's product and dates (adr/0076 Ek 2026-11-23)
    ...(row.product_id ? { ürün: row.product_id, talep: row.details } : {}),
    durum: row.status,
    gönderilme: row.created_at,
    ...messages.open(row.sealed),
  }))
}

/** For a KVKK erasure: their messages go, nothing of them kept (adr/0047). */
export async function eraseContactMessages(
  container: Container,
  customerId: string,
  addresses: string[]
): Promise<number> {
  const { messages, rows } = await messagesOf(container, customerId, addresses)
  if (rows.length > 0) {
    await messages.deleteContactMessages(rows.map((row) => row.id))
  }
  return rows.length
}
