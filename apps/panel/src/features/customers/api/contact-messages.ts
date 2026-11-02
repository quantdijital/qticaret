import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** What a shopper writes about, from the form's fixed list (adr/0047 §3); `kvkk` is a data request. */
export const CONTACT_SUBJECTS = ["order", "product", "return", "payment", "kvkk", "other"] as const
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]

/** Waiting for an answer, or answered. */
export const CONTACT_STATUSES = ["new", "handled"] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const CONTACT_PAGE_SIZE = 50

export const isContactSubject = (value: unknown): value is ContactSubject =>
  typeof value === "string" && (CONTACT_SUBJECTS as readonly string[]).includes(value)

/** A message from the storefront's contact form, opened by the server for the panel. */
export interface ContactMessage {
  id: string
  subject: ContactSubject
  /** As the shopper wrote it, digits only. */
  order_number: string | null
  customer_id: string | null
  status: ContactStatus
  handled_by: string | null
  handled_at: string | null
  created_at: string
  name: string
  email: string
  /** E.164 (+90…). */
  phone: string | null
  body: string
}

interface ContactMessagesResponse {
  contact_messages: ContactMessage[]
  count: number
  offset: number
  limit: number
}

const PATH = "/admin/contact-messages"
export const CONTACT_MESSAGES_KEY = ["contact-messages"] as const

/** Waiting ones oldest first, answered ones newest first; reading them is recorded (adr/0047 §6). */
export const contactMessagesQuery = (status: ContactStatus, page: number) =>
  queryOptions({
    queryKey: [...CONTACT_MESSAGES_KEY, status, page],
    queryFn: () =>
      sdk.client.fetch<ContactMessagesResponse>(PATH, {
        query: { status, offset: page * CONTACT_PAGE_SIZE, limit: CONTACT_PAGE_SIZE },
      }),
  })

/** Answered, or back to waiting: operations may (adr/0047 §6). */
export const markContactMessage = (id: string, status: ContactStatus) =>
  sdk.client.fetch<{ id: string; status: ContactStatus }>(`${PATH}/${encodeURIComponent(id)}`, {
    method: "POST",
    body: { status },
  })

/** Gone for good, not hidden: the owner and admins only. */
export const deleteContactMessage = (id: string) =>
  sdk.client.fetch<{ id: string; deleted: true }>(`${PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
