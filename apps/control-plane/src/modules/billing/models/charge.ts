import { model } from "@medusajs/framework/utils"
import { BILLING_PERIODS, CHARGE_STATUSES, PAYMENT_METHODS } from "@qticaret/types/control-plane"

/**
 * One period's payment (adr/0061 §2 `charge`, Ek C16): what the shop owes
 * for `[period_start, period_end)`, due on `due_on` (the period's first
 * day: paid ahead). Staff mark it paid (date, method, reference), waive it
 * or void it; they may correct its amount with a reason (`list_amount`
 * keeps the package's price it opened with). One charge per subscription
 * and period start, so two runs of the job never open the same twice.
 * The invoice fields stay empty while our own invoicing is off
 * (`SubscriptionInvoiceIssuer` `none`, §7).
 */
export const Charge = model
  .define("charge", {
    id: model.id({ prefix: "chg" }).primaryKey(),
    subscription_id: model.text(),
    tenant_id: model.text(),
    period: model.enum([...BILLING_PERIODS]),
    period_start: model.text(),
    period_end: model.text(),
    /** Kuruş, TRY: what is owed. */
    amount: model.number(),
    /** Kuruş: the package's price when the charge opened. */
    list_amount: model.number(),
    currency_code: model.text().default("TRY"),
    due_on: model.text(),
    status: model.enum([...CHARGE_STATUSES]).default("open"),
    paid_on: model.text().nullable(),
    method: model.enum([...PAYMENT_METHODS]).nullable(),
    /** The bank's receipt or another reference; plain text. */
    reference: model.text().nullable(),
    /** Who marked it paid, waived or void (a user id), and when. */
    settled_by: model.text().nullable(),
    settled_at: model.dateTime().nullable(),
    /** Why it was waived or voided. */
    settle_reason: model.text().nullable(),
    /** Why its amount was corrected (the latest correction). */
    amount_reason: model.text().nullable(),
    invoice_number: model.text().nullable(),
    invoice_ettn: model.text().nullable(),
    invoice_pdf_url: model.text().nullable(),
  })
  .indexes([
    { on: ["subscription_id", "period_start"], unique: true, where: "deleted_at IS NULL" },
    { on: ["tenant_id", "due_on"], where: "deleted_at IS NULL" },
    { on: ["status", "due_on"], where: "deleted_at IS NULL" },
  ])
