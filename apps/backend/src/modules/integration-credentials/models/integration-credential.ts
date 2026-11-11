import { model } from "@medusajs/framework/utils"

/**
 * The shop's account with one provider (adr/0027): settings in the clear,
 * every secret in one envelope (adr/0061 Ek C17: its own data key, wrapped
 * under the credentials KEK) bound to the provider and its settings. Rows
 * from before are adr/0027's AES-256-GCM blob, upgraded as they are read.
 * A removed account is deleted outright, so no ciphertext lingers.
 */
export const IntegrationCredential = model.define("integration_credential", {
  id: model.id({ prefix: "icred" }).primaryKey(),
  provider: model.text().unique(),
  settings: model.json(),
  secret_ciphertext: model.text(),
  /**
   * The envelope's KEK id (an adr/0027 row: its key's fingerprint). A key no
   * longer configured reads as "enter again"; the key status counts by it.
   */
  key_id: model.text(),
  /** Counts secret changes; the audit record shows this, never the secrets. */
  secrets_version: model.number().default(1),
  /** `rejected`: the provider refused the stored details when they were tested again. */
  verification: model.enum(["verified", "unverified", "rejected"]),
  verified_at: model.dateTime().nullable(),
  updated_by: model.text().nullable(),
})
