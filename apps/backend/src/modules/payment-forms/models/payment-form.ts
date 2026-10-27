import { model } from "@medusajs/framework/utils"

/**
 * A hosted form we gave out (F5 V9, security review 2026-10-27): its
 * token stays payable at the provider after Medusa deletes the session
 * (a payment started again replaces it). For a provider whose result
 * reaches us only through the shopper's browser (iyzico, without its
 * webhook), the reconcile job asks about every open form from here, not
 * from the sessions left. Nothing personal; the token is in the session's
 * public data too.
 */
export const PaymentForm = model
  .define("payment_form", {
    id: model.id({ prefix: "payform" }).primaryKey(),
    provider: model.text(),
    session_id: model.text(),
    cart_id: model.text(),
    token: model.text(),
    status: model.enum(["open", "closed"]).default("open"),
    /** What closed it: `paid`, `orphan`, `failed`, `unpaid` (lapsed), `abandoned` (past a day). */
    outcome: model.text().nullable(),
    expires_at: model.dateTime(),
  })
  .indexes([{ on: ["session_id"], unique: true }, { on: ["provider", "status", "created_at"] }])
