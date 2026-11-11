import { model } from "@medusajs/framework/utils"

/**
 * A shop's runtime secrets sealed to the offline `age` recipients
 * (adr/0061 §4.3): the only copy the platform keeps, and one it cannot
 * open. Each issue of the set is a new version. `recipients` are the
 * public keys it was sealed to (which offline key opens it), never an
 * identity.
 */
export const SecretEscrow = model
  .define("secret_escrow", {
    id: model.id({ prefix: "sesc" }).primaryKey(),
    tenant_id: model.text(),
    version: model.number(),
    /** An armored age file (`-----BEGIN AGE ENCRYPTED FILE-----`). */
    sealed: model.text(),
    /** Comma-separated `age1…` public keys. */
    recipients: model.text(),
  })
  .indexes([{ on: ["tenant_id", "version"], unique: true }])
