import { model } from "@medusajs/framework/utils"

/** One change of a consent, never edited or removed: the proof İYS and a complaint ask for. */
export const MessageConsentEvent = model
  .define("message_consent_event", {
    id: model.id({ prefix: "mcev" }).primaryKey(),
    consent_id: model.text(),
    channel: model.enum(["email", "sms", "call"]),
    status: model.enum(["granted", "revoked"]),
    source: model.enum(["checkout", "account", "panel", "import", "iys", "unsubscribe"]),
    changed_at: model.dateTime(),
    changed_by: model.text().nullable(),
    /**
     * How it was given (adr/0038 §2): the staff's note for a panel grant;
     * the text's version, the order or cart and a keyed hash of the IP for
     * the storefront's. Never an address.
     */
    evidence: model.json().nullable(),
  })
  .indexes([{ on: ["consent_id"] }])
