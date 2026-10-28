import { model } from "@medusajs/framework/utils"

/**
 * The boxes a shopper ticked at checkout (adr/0038 §2), kept against the
 * cart until it becomes an order: then the consents are recorded for the
 * order's e-mail and phone, with this as their proof, and the row goes.
 */
export const CheckoutConsent = model
  .define("checkout_consent", {
    id: model.id({ prefix: "ckcons" }).primaryKey(),
    cart_id: model.text(),
    email: model.boolean().default(false),
    sms: model.boolean().default(false),
    /** The consent text's version the storefront showed. */
    text_version: model.text(),
    /** A keyed hash of the shopper's IP address. */
    ip_hash: model.text().nullable(),
    given_at: model.dateTime(),
  })
  .indexes([{ on: ["cart_id"], unique: true, where: "deleted_at IS NULL" }])
