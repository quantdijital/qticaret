import type { MedusaContainer } from "@medusajs/framework/types"
import {
  BILLING_HISTORY_LIMIT,
  billingHistorySchema,
  billingRecordSchema,
  invoiceUrlSchema,
} from "@qticaret/types/control-plane"
import type { BillingHistory, BillingRecord } from "@qticaret/types/control-plane"
import type { ChargeRecord } from "../../modules/billing/types"
import { billingIn } from "../../workflows/modules"

type Container = Pick<MedusaContainer, "resolve">

const SHOWN = new Set<string>(["open", "paid", "waived"])

/**
 * One charge as its shop sees it (adr/0061 Ek C20): the period, the day it
 * was due and paid, the amount and status, the invoice when our invoicing
 * made one. Never what staff wrote (the bank's reference, who settled it,
 * why it was waived or corrected) nor the package's list price. An
 * invoice link that is not plain https is left out, never sent; the
 * invoice's number goes with it.
 */
export function historyRecordOf(charge: ChargeRecord): BillingRecord | null {
  if (!SHOWN.has(charge.status) || charge.currency_code !== "TRY") {
    return null
  }
  const url = invoiceUrlSchema.safeParse(charge.invoice_pdf_url)
  const number = charge.invoice_number?.trim() ?? ""
  return {
    id: charge.id,
    period: charge.period,
    period_start: charge.period_start,
    period_end: charge.period_end,
    due_on: charge.due_on,
    amount: charge.amount,
    currency: "TRY",
    status: charge.status as BillingRecord["status"],
    paid_on: charge.status === "paid" ? charge.paid_on : null,
    invoice_number: number.length > 0 && number.length <= 64 ? number : null,
    invoice_url: url.success ? url.data : null,
  }
}

/**
 * A shop's payment history (Ek C20), held to the contract's strict schema
 * before anything signs it: its own charges only (by the id the request's
 * signature proved), the latest period first, at most two years'. A
 * record the schema would refuse is dropped, not the whole answer.
 */
export async function billingHistoryOf(
  container: Container,
  tenantId: string
): Promise<BillingHistory> {
  const charges = await billingIn(container).historyOf(tenantId, BILLING_HISTORY_LIMIT)
  const records = charges
    .filter((charge) => charge.tenant_id === tenantId)
    .map(historyRecordOf)
    .filter((record) => record !== null && billingRecordSchema.safeParse(record).success)
    .slice(0, BILLING_HISTORY_LIMIT)
  return billingHistorySchema.parse({ tenant_id: tenantId, records })
}
