import { decide } from "../staff/permissions"
import type { StaffRole } from "../staff/permissions"
import type { Method } from "../staff/permission-rules"
import { WHOLESALE_ORDER_TRIGGER } from "./feed"

/**
 * Which roles see which alerts (adr/0020, adr/0040). Every kind written to
 * the feed is named here, one of two ways; a kind named in neither (a new
 * writer forgotten here) is the owner's alone until it is: fail closed.
 * A unit test reads the files that write to the feed and checks each
 * `trigger_type` written as a literal, each template's values (from the
 * union type it is built on, listed in the test) and the two constants
 * against these lists; a kind built some other way is not caught there,
 * only kept from the other roles here.
 */

/** Every role's: an order's, a payment's trouble, a customer's message, stock, returns, invoices. */
export const OPEN_ALERTS: readonly string[] = [
  "orders.new_order",
  "orders.bank_transfer_pending",
  "orders.fraud_review",
  "orders.stock_short",
  "returns.refund_deadline_near",
  "payments.completion_stuck",
  "payments.refunded_before_order",
  "payments.shelf_restored",
  "payments.orphan_recorded",
  "payments.orphan_refunded",
  "payments.orphan_refund_failed",
  "payment_links.paid",
  "payment_links.prices_changed",
  "payment_links.out_of_stock",
  "stock.low",
  "einvoice.issue_stopped",
  "einvoice.return_needed",
  "einvoice.return_invoice_due",
  "einvoice.expense_voucher_due",
  "contact_message.received",
  // Counts only (sent, refused, minutes): no address, nothing private in it
  "messaging.smtp_rejections",
  "messaging.email_daily_limit",
  "messaging.sms_daily_limit",
  "campaigns.paused_complaints",
]

/**
 * The kinds closed to some roles, each named by one route, read as a
 * capability is (`capabilitiesOf`: one representative route, decided by
 * the same rules): the page the alert is about, or the work it asks for.
 */
export const ALERT_ACCESS: Readonly<Record<string, readonly [Method, string]>> = {
  // ADR-0068 §9: the wholesalers (the `wholesale` capability's route)
  [WHOLESALE_ORDER_TRIGGER]: ["GET", "/admin/wholesale/accounts"],
  // A wholesaler's cart priced off its list (PR #100): only its cart's id, but about wholesale
  "payments.wholesale_price_check": ["GET", "/admin/wholesale/accounts"],
  // A provider account changed, and by whom: the accounts' own page (private)
  "integration_credentials.changed": ["GET", "/admin/integrations/credentials"],
  // A hook turned off, with its host: the hooks' page (private)
  "webhooks.disabled": ["GET", "/admin/webhooks"],
  // The move from the old platform (the `migration` capability's route: the owner's)
  "migration.not_found_seen": ["POST", "/admin/migrations"],
  // The accounting program refusing records: sending them again
  "accounting.sync_stopped": ["POST", "/admin/accounting/syncs/:id/retry"],
  // A provider's statement not matching the orders: the money's (the `money` capability's route)
  "payments.statement_mismatch": ["POST", "/admin/orders/:id/refunds"],
}

/**
 * The alert kinds (`trigger_type`) this role gets; null: every kind, the
 * unknown ones too (the owner). Anyone else gets the open kinds and the
 * closed ones their role reaches, never one named nowhere.
 */
export function visibleTriggers(role: StaffRole | null): string[] | null {
  if (role === "owner") {
    return null
  }
  if (role === null) {
    return []
  }
  return [
    ...OPEN_ALERTS,
    ...Object.entries(ALERT_ACCESS)
      .filter(([, [method, path]]) => decide(role, method, path).allowed)
      .map(([trigger]) => trigger),
  ]
}
