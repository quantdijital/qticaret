import { model } from "@medusajs/framework/utils"

/**
 * A consent asked for an address no one has shown is theirs (security
 * review 2026-10-29): a guest's e-mail at checkout, a phone typed in an
 * account. Nothing is recorded, nor told to İYS, until the address's
 * owner opens the link sent to it and confirms. The address is kept
 * encrypted to send that link and to record the answer; the token only
 * as a hash.
 */
export const ConsentRequest = model
  .define("consent_request", {
    id: model.id({ prefix: "creq" }).primaryKey(),
    channel: model.enum(["email", "sms"]),
    recipient_hash: model.text(),
    recipient_encrypted: model.text(),
    /** What the confirmation records: consent given, or withdrawn. */
    status: model.enum(["granted", "revoked"]),
    source: model.enum(["checkout", "account"]),
    customer_id: model.text().nullable(),
    /** How it was asked for, as the consent will keep it; never an address. */
    evidence: model.json().nullable(),
    token_hash: model.text(),
    expires_at: model.dateTime(),
    confirmed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["token_hash"], unique: true, where: "deleted_at IS NULL" },
    { on: ["recipient_hash"], where: "deleted_at IS NULL" },
  ])
