import { CP_STAFF_ROLES } from "./roles"
import type { RouteRule } from "./route-table"

/**
 * Billing (adr/0061 §3.5, §7, Ek C16). Reading the payments and a shop's
 * subscription is everyone's (amounts and days, no personal data). The
 * money's changes are finance's and the owner's, each proved again
 * (§3.5 "ödeme işaretleme ve bağışlama"): marking paid, waiving,
 * correcting an amount and a shop's own grace days. Voiding a charge (it
 * says nothing was owed) and the payment instruction every shop shows
 * (an account number is a target) are the owner's alone. A shop's routes
 * record against the shop, so its activity shows them.
 */
const ALL = CP_STAFF_ROLES
const FINANCE = ["owner", "finance"] as const
const OWNER = ["owner"] as const
const TENANT = { type: "tenant", param: "id" } as const
const CHARGE = "/admin/cp/tenants/:id/charges/:charge_id"

export const BILLING_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/payments", access: ALL },
  { method: "GET", path: "/admin/cp/tenants/:id/subscription", access: ALL, resource: TENANT },
  {
    method: "POST",
    path: "/admin/cp/tenants/:id/subscription",
    access: FINANCE,
    stepUp: true,
    resource: TENANT,
  },
  ...["/pay", "/waive", "/amount"].map((action): RouteRule => ({
    method: "POST",
    path: `${CHARGE}${action}`,
    access: FINANCE,
    stepUp: true,
    resource: TENANT,
  })),
  { method: "POST", path: `${CHARGE}/void`, access: OWNER, stepUp: true, resource: TENANT },
  { method: "GET", path: "/admin/cp/billing-settings", access: ALL },
  {
    method: "POST",
    path: "/admin/cp/billing-settings",
    access: OWNER,
    stepUp: true,
    resource: { type: "billing_setting" },
  },
]
