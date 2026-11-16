import { decide } from "../staff/permissions"
import type { StaffRole } from "../staff/permissions"
import type { Method } from "../staff/permission-rules"
import { WHOLESALE_ORDER_TRIGGER } from "./feed"

/**
 * Which roles see which alerts (adr/0020, adr/0040): an alert about
 * something a role cannot reach is not that role's. Each kind closed to
 * some roles names one route, read as a capability is (`capabilitiesOf`:
 * one representative route, decided by the same rules): the page the
 * alert is about, or the work it asks for. Every other kind is every
 * role's: a payment's trouble, a customer's message, stock, returns, an
 * order's invoice. The list, the bell's count and marking read all leave
 * out the same kinds (`hiddenTriggers`).
 */
export const ALERT_ACCESS: Readonly<Record<string, readonly [Method, string]>> = {
  // ADR-0068 §9: the wholesalers (the `wholesale` capability's route)
  [WHOLESALE_ORDER_TRIGGER]: ["GET", "/admin/wholesale/accounts"],
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

/** The alert kinds (`trigger_type`) this role does not get; none without a role means all. */
export function hiddenTriggers(role: StaffRole | null): string[] {
  return Object.entries(ALERT_ACCESS)
    .filter(([, [method, path]]) => role === null || !decide(role, method, path).allowed)
    .map(([trigger]) => trigger)
}
