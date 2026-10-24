import { model } from "@medusajs/framework/utils"

/**
 * Invoice identity of a customer (adr/0009), linked 1-1 to the customer.
 * The tax id is stored only encrypted, plus a keyed hash for lookups and
 * the last four digits for masked display; plaintext is never persisted.
 */
export const BillingProfile = model
  .define("billing_profile", {
    id: model.id({ prefix: "bprof" }).primaryKey(),
    type: model.enum(["individual", "corporate"]),
    /** Full name for individuals, registered company name for corporates. */
    legal_name: model.text(),
    tax_office: model.text().nullable(),
    tax_id_kind: model.enum(["tckn", "vkn"]),
    tax_id_encrypted: model.text(),
    tax_id_hash: model.text(),
    tax_id_last4: model.text(),
    key_version: model.number().default(1),
  })
  .indexes([{ on: ["tax_id_hash"], where: "deleted_at IS NULL" }])
