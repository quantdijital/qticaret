import { model } from "@medusajs/framework/utils"

/**
 * The shop's Paraşüt company, connected with the platform's client (F8,
 * adr/0034 §5). Its tokens are kept here, not with the provider accounts
 * (adr/0027): Paraşüt hands out a new refresh token on every refresh, so
 * they change every two hours, and the row is locked while they do so two
 * processes never spend the same one. Both encrypted with
 * `PII_ENCRYPTION_KEY`, bound to the company. One row at most.
 */
export const ParasutConnection = model
  .define("parasut_connection", {
    id: model.id({ prefix: "pcon" }).primaryKey(),
    /** Always "parasut": the unique index keeps the shop at one company. */
    slot: model.text().default("parasut"),
    company_id: model.text(),
    access_token_encrypted: model.text(),
    refresh_token_encrypted: model.text(),
    access_expires_at: model.dateTime(),
    /** `broken` once Paraşüt refuses the refresh token: the shop connects again. */
    status: model.enum(["connected", "broken"]).default("connected"),
    /** A code only (`invalid_grant`). */
    last_error: model.text().nullable(),
    connected_by: model.text().nullable(),
    connected_at: model.dateTime(),
    checked_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["slot"], unique: true, where: "deleted_at IS NULL" }])
