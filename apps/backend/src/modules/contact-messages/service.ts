import { MedusaService } from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey } from "@qticaret/server-kit"
import { ValidationError } from "../../lib/errors"
import { normalizeRecipient } from "../../lib/messaging/recipients"
import { CONTACT_STATUSES, CONTACT_SUBJECTS, ContactMessage } from "./models/contact-message"

export { CONTACT_STATUSES, CONTACT_SUBJECTS }

export interface ContactMessagesOptions {
  hashKey: string
  encryptionKey: string
}

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]

/**
 * What a booking request asks for (adr/0076 Ek 2026-11-23): one departure,
 * a day or a month, or none (the dates are open); how many people. No
 * person's data: it stays in the open.
 */
export interface BookingRequestDetails {
  slot_id?: string
  /** YYYY-MM-DD */
  date?: string
  /** YYYY-MM */
  month?: string
  adults: number
  children?: number
}

/** What the person wrote: sealed at rest, opened for the panel. */
export interface ContactContent {
  name: string
  /** Empty only on a booking request left with a phone. */
  email: string
  phone: string | null
  body: string
}

export interface ReceiveInput extends ContactContent {
  subject: ContactSubject
  order_number: string | null
  customer_id: string | null
  /** A booking request's product and what it asks for (subject `booking`). */
  product_id?: string | null | undefined
  details?: BookingRequestDetails | null | undefined
}

const SEAL = "contact-messages.content"
const HASH = "contact-messages.email"

/** Contact messages (F18 D10, adr/0047): kept sealed, answered from the panel. */
class ContactMessagesModuleService extends MedusaService({ ContactMessage }) {
  private readonly hashKey: Buffer
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: ContactMessagesOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "contact-messages hashKey")
    this.encryptionKey = parseKey(options.encryptionKey, "contact-messages encryptionKey")
  }

  /** The keyed hash a person's address is found by; null for no address. */
  emailHashOf(email: string): string | null {
    const normalized = normalizeRecipient("email", email)
    return normalized ? hashPii(normalized, this.hashKey, HASH) : null
  }

  async receive(input: ReceiveInput): Promise<{ id: string }> {
    // A booking request may come with a phone only; a message is answered by e-mail
    const optional = input.subject === "booking" && input.email === "" && Boolean(input.phone)
    const email = optional ? "" : normalizeRecipient("email", input.email)
    if (email === null || (!optional && !email)) {
      throw new ValidationError("messaging.recipient_invalid", { field: "email" })
    }
    const content: ContactContent = {
      name: input.name,
      email,
      phone: input.phone,
      body: input.body,
    }
    const created = await this.createContactMessages({
      customer_id: input.customer_id,
      subject: input.subject,
      order_number: input.order_number,
      product_id: input.product_id ?? null,
      details: (input.details ?? null) as Record<string, unknown> | null,
      email_hash: email ? hashPii(email, this.hashKey, HASH) : null,
      sealed: encryptPii(JSON.stringify(content), this.encryptionKey, SEAL),
      status: "new",
    })
    return { id: created.id }
  }

  /** What a message says; a seal that does not open (a changed key) reads empty. */
  open(sealed: string): ContactContent {
    try {
      return JSON.parse(decryptPii(sealed, this.encryptionKey, SEAL)) as ContactContent
    } catch {
      return { name: "", email: "", phone: null, body: "" }
    }
  }
}

export default ContactMessagesModuleService
