import { model } from "@medusajs/framework/utils"
import { STATEMENT_PROVIDERS } from "../../../lib/payments/statements"

export const CHECK_STATUSES = ["matched", "mismatched", "failed"] as const

/**
 * A day's payment statement checked against the shop (F11.3, adr/0039
 * §3): one per provider, Turkish day and mode, replaced when the day is
 * checked again. A test account's check is kept apart: a sandbox check
 * never replaces a live day's result. The issues name references, order
 * numbers and amounts only; nothing about the shopper or the card.
 */
export const StatementCheck = model
  .define("statement_check", {
    id: model.id({ prefix: "stmchk" }).primaryKey(),
    provider: model.enum([...STATEMENT_PROVIDERS]),
    /** `YYYY-MM-DD`, as Turkey counts days. */
    day: model.text(),
    /** Checked with the provider's test account: compared against test payments only. */
    test_mode: model.boolean().default(false),
    status: model.enum([...CHECK_STATUSES]),
    /** The shop's payments taken that day that the statement agrees with. */
    matched: model.number().default(0),
    /** The provider's sales that day. */
    sales: model.number().default(0),
    /** `StatementIssue[]`. */
    issues: model.json(),
    /** Why the statement could not be read (a failed check), the provider's code only. */
    error_code: model.text().nullable(),
    checked_at: model.dateTime(),
  })
  .indexes([
    { on: ["provider", "day", "test_mode"], unique: true, where: "deleted_at IS NULL" },
    { on: ["day"] },
  ])
