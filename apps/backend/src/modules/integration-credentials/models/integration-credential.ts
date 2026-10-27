import { model } from "@medusajs/framework/utils"

/**
 * The shop's account with one provider (adr/0027): settings in the clear,
 * every secret in one AES-256-GCM blob bound to the provider's name. A
 * removed account is deleted outright, so no ciphertext lingers.
 */
export const IntegrationCredential = model.define("integration_credential", {
  id: model.id({ prefix: "icred" }).primaryKey(),
  provider: model.text().unique(),
  settings: model.json(),
  secret_ciphertext: model.text(),
  /** Fingerprint of the key that sealed the blob: a changed key reads as "enter again". */
  key_id: model.text(),
  /** Counts secret changes; the audit record shows this, never the secrets. */
  secrets_version: model.number().default(1),
  /** `rejected`: the provider refused the stored details when they were tested again. */
  verification: model.enum(["verified", "unverified", "rejected"]),
  verified_at: model.dateTime().nullable(),
  updated_by: model.text().nullable(),
})
