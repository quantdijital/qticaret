import { model } from "@medusajs/framework/utils"

/**
 * What a message is about; `kvkk` is a guest's data request (KVKK md. 11,
 * adr/0047 Ek 2026-11-02), answered within the law's 30 days; `booking` a
 * dated product's call-me request (adr/0076 Ek 2026-11-23), sent from the
 * product's page, not the contact form.
 */
export const CONTACT_SUBJECTS = [
  "order",
  "product",
  "return",
  "payment",
  "kvkk",
  "booking",
  "other",
] as const
/** The contact form's subjects: a booking request has its own route. */
export const CONTACT_FORM_SUBJECTS = [
  "order",
  "product",
  "return",
  "payment",
  "kvkk",
  "other",
] as const
export const CONTACT_STATUSES = ["new", "handled"] as const

/**
 * A message sent from the storefront's contact form (F18 D10, adr/0047).
 * What the person wrote (name, address, phone, message) is kept sealed,
 * opened only for the panel; the address also as a keyed hash, to find
 * a person's messages for a KVKK request. Deleted a year after it came.
 */
export const ContactMessage = model
  .define("contact_message", {
    id: model.id({ prefix: "cmsg" }).primaryKey(),
    /** The signed-in customer who sent it, if any. */
    customer_id: model.text().nullable(),
    subject: model.enum([...CONTACT_SUBJECTS]),
    /** The order the message is about, as the shopper typed its number. */
    order_number: model.text().nullable(),
    /** Empty for a booking request left with a phone only. */
    email_hash: model.text().nullable(),
    /** The phone as a keyed hash, to find a person's messages by it for a KVKK request. */
    phone_hash: model.text().nullable(),
    /** A booking request's product (adr/0076 Ek 2026-11-23). */
    product_id: model.text().nullable(),
    /** A booking request's `{ slot_id?, date?, month?, adults, children? }`; no person's data. */
    details: model.json().nullable(),
    /** `{ name, email, phone, body }`, sealed. */
    sealed: model.text(),
    status: model.enum([...CONTACT_STATUSES]).default("new"),
    handled_by: model.text().nullable(),
    handled_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["status", "created_at"], where: "deleted_at IS NULL" },
    { on: ["email_hash"], where: "deleted_at IS NULL" },
    { on: ["phone_hash"], where: "phone_hash IS NOT NULL AND deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
  ])
