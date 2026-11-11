import { model } from "@medusajs/framework/utils"

/**
 * The control plane's Ed25519 signing keys (adr/0061 §3.2, §4.5, Ek C8).
 * The private half is a platform `secret_record` (`secret_name`); this row
 * is what may be shown: `kid`, public key, status.
 *
 * - `next`: made and published to the shops, not signing yet
 * - `active`: signs every new document (one at a time)
 * - `previous`: replaced, still published so documents it signed keep
 *   verifying while the shops take the new key
 * - `retired`: no longer published; its private half destroyed
 */
export const SIGNING_KEY_STATUSES = ["next", "active", "previous", "retired"] as const
export type SigningKeyStatus = (typeof SIGNING_KEY_STATUSES)[number]

export const CpSigningKey = model
  .define("cp_signing_key", {
    id: model.id({ prefix: "cpsk" }).primaryKey(),
    kid: model.text(),
    /** The raw 32-byte public key, base64url. */
    public_key: model.text(),
    status: model.enum([...SIGNING_KEY_STATUSES]),
    secret_name: model.text(),
    activated_at: model.dateTime().nullable(),
    retired_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["kid"], unique: true },
    ...(["next", "active", "previous"] as const).map((status) => ({
      name: `IDX_cp_signing_key_one_${status}`,
      on: ["status" as const],
      unique: true,
      where: `status = '${status}' AND deleted_at IS NULL`,
    })),
  ])
