import { model } from "@medusajs/framework/utils"

/**
 * A secret the control plane can open (adr/0061 §2, §4.1-4.2): its own
 * signing key, later its e-mail and invoicing accounts. Envelope-sealed:
 * its own data key under the current KEK, bound to owner + name +
 * version, in one column (`qtenv1.<kek_id>.<wrapped DEK>.<ciphertext>`,
 * Ek C1). `kek_id` repeats the envelope's KEK so a rotation finds what is
 * left to rewrap. A new value is a new version; versions are never
 * rewritten, only rewrapped or retired (emptied, soft-deleted, number
 * kept). A shop's runtime secrets are never here (§4.3: made, delivered,
 * forgotten; escrow only).
 */
export const SecretRecord = model
  .define("secret_record", {
    id: model.id({ prefix: "secr" }).primaryKey(),
    /** `platform` or a shop's id. */
    owner: model.text(),
    name: model.text(),
    version: model.number(),
    kek_id: model.text(),
    sealed: model.text(),
  })
  .indexes([
    // Over retired (soft-deleted) rows too: a version is not reused
    { on: ["owner", "name", "version"], unique: true },
    { on: ["kek_id"] },
  ])
