/**
 * What each staff role may do (F12.6, adr/0040): four fixed roles, decided
 * by method and the path Express routes (lower-cased, as Express matches).
 * - `owner`: everything.
 * - `admin`: everything but the owner's own: the shop's accounts, its people
 *   and keys, where money and data leave the shop. Allowed by default: a new
 *   Medusa route is open to it.
 * - `operations`: reads all but the private, writes only the operational
 *   routes listed here (orders, shipping, returns, stock, moderation).
 *   Refused by default: a new route is closed to it until listed.
 * - `readonly`: reads all but the private, writes nothing but read-only jobs.
 * A user without a role (removed from the staff, or made outside the
 * panel) reaches nothing but who they are.
 */
import {
  OPERATIONS_WRITES,
  OWN,
  OWNER_ONLY,
  PRIVATE,
  READONLY_WRITES,
  REPLACED,
  SELF,
} from "./permission-rules"
import type { Method, RequestFacts, Rule } from "./permission-rules"

export type { RequestFacts } from "./permission-rules"

export const STAFF_ROLES = ["owner", "admin", "operations", "readonly"] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

/** The roles an invitation gives; an owner is made by an owner, from the team (adr/0040 §3). */
export const INVITABLE_ROLES = ["admin", "operations", "readonly"] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

const READS = new Set<string>(["GET", "HEAD", "OPTIONS"])

const compiled = new Map<string, RegExp>()

function patternOf(path: string): RegExp {
  let pattern = compiled.get(path)
  if (!pattern) {
    const below = path.endsWith("*")
    const body = (below ? path.slice(0, -1) : path)
      .split("/")
      .map((part) => (part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/")
    pattern = new RegExp(`^${body}${below ? "(/.*)?" : ""}$`)
    compiled.set(path, pattern)
  }
  return pattern
}

/**
 * The path as a route parameter reads it: Express decodes `:section`, so
 * `/admin/platform-settings/bank%5Ftransfer` runs the `bank_transfer`
 * section. What a list refuses is matched in both forms; what a list
 * allows, in the raw form only.
 */
function decodedPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join("/")
    .toLowerCase()
}

const matches = (rules: readonly Rule[], method: string, path: string, facts: RequestFacts) =>
  rules.some(
    (rule) =>
      (rule.methods === "*" || rule.methods.includes(method as Method)) &&
      patternOf(rule.path).test(path) &&
      (rule.when ? rule.when(facts) : true)
  )

/** Whether the route is one every signed-in user may call about themselves. */
export const isSelfRoute = (method: string, path: string): boolean =>
  matches(SELF, method.toUpperCase(), path, {})

export interface Decision {
  allowed: boolean
  /** Why, for the log: the list that decided. */
  reason:
    | "self"
    | "own"
    | "replaced"
    | "owner"
    | "owner_only"
    | "admin"
    | "private"
    | "read"
    | "listed"
    | "unlisted"
}

/**
 * Whether `role` may call `method` on `path`. `path` is the request path
 * as Express routes it, lower-cased, without its query or trailing slash.
 */
export function decide(
  role: StaffRole,
  method: string,
  path: string,
  facts: RequestFacts = {}
): Decision {
  const verb = method.toUpperCase()
  if (matches(SELF, verb, path, facts)) {
    return { allowed: true, reason: "self" }
  }
  const decoded = decodedPath(path)
  const refused = (rules: readonly Rule[]) =>
    matches(rules, verb, path, facts) || matches(rules, verb, decoded, facts)
  if (refused(REPLACED)) {
    return { allowed: false, reason: "replaced" }
  }
  // One's own account, whatever the role (and only one's own: the handlers read no id)
  if (matches(OWN, verb, path, facts)) {
    return { allowed: true, reason: "own" }
  }
  if (role === "owner") {
    return { allowed: true, reason: "owner" }
  }
  if (refused(OWNER_ONLY)) {
    return { allowed: false, reason: "owner_only" }
  }
  if (role === "admin") {
    return { allowed: true, reason: "admin" }
  }
  if (refused(PRIVATE)) {
    return { allowed: false, reason: "private" }
  }
  if (READS.has(verb)) {
    return { allowed: true, reason: "read" }
  }
  const writes = role === "operations" ? OPERATIONS_WRITES : READONLY_WRITES
  return matches(writes, verb, path, facts)
    ? { allowed: true, reason: "listed" }
    : { allowed: false, reason: "unlisted" }
}

/**
 * What the panel shows a role (the API decides again on every request):
 * each capability is one representative route, so the two never disagree.
 */
const CAPABILITY_PROBES = {
  settings: ["POST", "/admin/platform-settings/store"],
  catalog: ["POST", "/admin/products/:id"],
  marketing: ["POST", "/admin/promotions"],
  orders: ["POST", "/admin/orders/:id/ship"],
  money: ["POST", "/admin/orders/:id/refunds"],
  stock: ["POST", "/admin/inventory-items/location-levels/batch"],
  moderation: ["POST", "/admin/product-reviews/moderate"],
  accounts: ["POST", "/admin/integrations/credentials/:provider"],
  keys: ["POST", "/admin/api-access"],
  security: ["POST", "/admin/platform-settings/security"],
  // adr/0053: turning the storefront dark, the owner's alone
  maintenance: ["POST", "/admin/platform-settings/maintenance"],
  team: ["GET", "/admin/staff"],
  staff: ["POST", "/admin/staff/members/:id"],
  audit: ["GET", "/admin/audit-log"],
  taxId: ["POST", "/admin/customers/:id/billing-profile/reveal"],
  // F13.5: recording and answering a customer's KVKK requests
  privacy: ["POST", "/admin/customers/:id/privacy-requests"],
  // F8: an invoice's PDF, the buyer and their tax id on it
  invoices: ["GET", "/admin/invoices/:id/pdf"],
  // F14: moving the shop in from its old platform, the owner's alone
  migration: ["POST", "/admin/migrations"],
  // F15.6: releasing held orders and keeping the block list, owner and admin
  fraud: ["POST", "/admin/fraud/blocks"],
  // adr/0050: writing and sending bulk messages, owner and admin; everyone reads them
  bulkMessages: ["POST", "/admin/bulk-messages/:id/send"],
  // adr/0051: making a payment link (operations too, without a discount)
  paymentLinks: ["POST", "/admin/payment-links"],
  // adr/0051 §8: a link's discount, cancel and extension: owner and admin
  paymentLinksManage: ["POST", "/admin/payment-links/:id/cancel"],
  // adr/0056: writing site search's synonym groups, owner and admin; every role reads
  // them. Its routes decide as this does (the unit spec holds them to it)
  searchSynonyms: ["POST", "/admin/search/synonyms"],
  // F13.1: writing, publishing, dropping and restarting the legal texts' drafts, owner and
  // admin; every role reads them. Its routes decide as this does (the unit spec holds them to it)
  legalTexts: ["POST", "/admin/legal-documents/:kind/publish"],
  // adr/0007 Ek 2026-11-04: adding, renaming, removing the KDV rates and moving the
  // default, the owner's alone; every role reads them
  vatRates: ["POST", "/admin/vat-rates"],
  // The order list as an Excel or CSV file, every customer's details in it: the owner's alone
  orderExport: ["POST", "/admin/order-board/export"],
} as const satisfies Record<string, readonly [Method, string]>

export type Capability = keyof typeof CAPABILITY_PROBES

/** What a role may do; a user without one, nothing. */
export function capabilitiesOf(role: StaffRole | null): Record<Capability, boolean> {
  return Object.fromEntries(
    Object.entries(CAPABILITY_PROBES).map(([name, [method, path]]) => [
      name,
      role !== null && decide(role, method, path).allowed,
    ])
  ) as Record<Capability, boolean>
}
