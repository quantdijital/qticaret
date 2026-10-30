import { model } from "@medusajs/framework/utils"

/** A text the shopper accepted: which version, and what it said (its body's hash). */
export interface AcceptedDocument {
  kind: string
  version: number
  document_id: string
  body_hash: string | null
}

/**
 * The contracts a shopper accepted at checkout (F13.2, adr/0041 §2), kept
 * against the cart and then its order. Sent again, the last answer counts.
 * The IP address is evidence for a dispute, so it is kept encrypted, not
 * hashed.
 */
export const LegalConsent = model
  .define("legal_consent", {
    id: model.id({ prefix: "lcons" }).primaryKey(),
    cart_id: model.text(),
    order_id: model.text().nullable(),
    documents: model.json(),
    ip_encrypted: model.text().nullable(),
    given_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_legal_consent_cart",
      on: ["cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { name: "IDX_legal_consent_order", on: ["order_id"], where: "deleted_at IS NULL" },
  ])
