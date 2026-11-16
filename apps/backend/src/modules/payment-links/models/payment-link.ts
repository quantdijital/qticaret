import { model } from "@medusajs/framework/utils"
import { PAYMENT_LINK_STATUSES } from "../../../lib/payment-links/snapshot"

/**
 * A payment link staff made for a customer (adr/0051 §1): what it offers,
 * frozen at its making, and where it stands. `draft` is a link whose
 * prices moved since: it opens nothing until staff make a new one.
 *
 * The customer's contact and a preset address are one sealed field
 * (`PII_ENCRYPTION_KEY`), found by a keyed hash of the e-mail; the token
 * is kept as its SHA-256 to find the link by, and sealed so staff can
 * share it again. Thirty days after a link closes its sealed fields go
 * (docs/kvkk-envanter.md); the numbers stay.
 */
export const PaymentLink = model
  .define("payment_link", {
    id: model.id({ prefix: "plink" }).primaryKey(),
    /** `PL-<number>` in the panel and the messages. */
    number: model.autoincrement(),
    status: model.enum([...PAYMENT_LINK_STATUSES]).default("open"),
    token_hash: model.text().nullable(),
    token_sealed: model.text().nullable(),
    /** The latest the token can open, however far the link is extended. */
    token_ends_at: model.dateTime(),
    expires_at: model.dateTime(),
    created_by: model.text(),
    customer_id: model.text().nullable(),
    /** `PaymentLinkPrivate` (service.ts): contact and address, sealed. */
    sealed: model.text().nullable(),
    email_hash: model.text().nullable(),
    /** `PaymentLinkLine[]`. */
    lines: model.json(),
    /** `PaymentLinkDiscount`, or null. */
    discount: model.json().nullable(),
    /** The link's own hidden, single-use promotion and its code. */
    promotion_id: model.text().nullable(),
    promotion_code: model.text().nullable(),
    /** A preset shipping option; null leaves it to the checkout. */
    shipping_option_id: model.text().nullable(),
    /** Staff's own note, never shown to the customer. */
    note: model.text().nullable(),
    currency_code: model.text().default("try"),
    /** Kuruş, as worked out at the making. */
    items_total: model.number(),
    discount_total: model.number().default(0),
    /** The latest cart opened from it: an earlier one no longer completes. */
    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),
    /**
     * The cart whose completion holds the link (`claimForCart`, service.ts):
     * while it holds it no other cart of the link becomes an order. Released
     * when that completion fails; a hold older than its time-out is free.
     */
    claimed_cart_id: model.text().nullable(),
    claimed_at: model.dateTime().nullable(),
    opened_count: model.number().default(0),
    last_opened_at: model.dateTime().nullable(),
    sent_count: model.number().default(0),
    last_sent_at: model.dateTime().nullable(),
    paid_at: model.dateTime().nullable(),
    canceled_by: model.text().nullable(),
    /** When it was paid, canceled or expired: its personal data's thirty days run from here. */
    closed_at: model.dateTime().nullable(),
    purged_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["token_hash"], unique: true, where: "deleted_at IS NULL AND token_hash IS NOT NULL" },
    { on: ["number"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "expires_at"], where: "deleted_at IS NULL" },
    { on: ["promotion_code"], where: "deleted_at IS NULL AND promotion_code IS NOT NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL AND customer_id IS NOT NULL" },
    { on: ["email_hash"], where: "deleted_at IS NULL AND email_hash IS NOT NULL" },
    { on: ["closed_at"], where: "deleted_at IS NULL AND purged_at IS NULL" },
    { on: ["created_at"], where: "deleted_at IS NULL" },
  ])
