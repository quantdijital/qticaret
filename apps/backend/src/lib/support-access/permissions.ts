/**
 * What a "Platform desteği" session may do (adr/0061 Ek "Destek erişimi",
 * Karar 5): only what `allowed.ts` names (the catalogue, the storefront's
 * looks, orders and customers read, what the panel draws itself with),
 * and never what the deny list below names, which is checked first: the
 * shop's people and its accounts, money, tax and legal settings, customers'
 * personal data leaving in bulk, ways for data to leave the shop, the audit
 * trail and the support switch. Medusa's own ways round the role layer
 * (`REPLACED`) stay closed as for everyone. Decided on the path Express
 * routes (lower-cased), every list matched raw and decoded for a refusal,
 * raw only for an allowance, as `decide` does. Queued jobs: an allow-list
 * of kinds, so a new export is closed until listed.
 */
import { capabilityProbes, matches } from "../staff/permissions"
import type { Capability } from "../staff/permissions"
import { REPLACED, SELF } from "../staff/permission-rules"
import type { Method, RequestFacts, Rule } from "../staff/permission-rules"
import { SUPPORT_ALLOWED, SUPPORT_PAGE_MAX, SUPPORT_WRITE_SECTIONS } from "./allowed"

const WRITES: readonly Method[] = ["POST", "PUT", "PATCH", "DELETE"]

/** The settings sections a support session never writes. */
export const SUPPORT_CLOSED_SECTIONS = [
  "accounting",
  "invoicing",
  "bank_transfer",
  "payments",
  "payment_links",
  "security",
  "maintenance",
  "legal",
  // The shop's contact address and phone: a way to reach customers in its name (review M-A)
  "store",
  // Who gets the staff alerts by e-mail (customers' details in them): an address added
  // here would keep receiving them after the session (security review M1)
  "notifications",
] as const

/** The queued jobs a support session may start: none of them takes customers' data out. */
export const SUPPORT_JOB_TYPES: ReadonlySet<string> = new Set([
  "catalog.bulk_edit",
  "catalog.description_facts",
  "catalog.export",
  "catalog.import",
  "content.link_rewrite",
  "promotion.codes",
  "sample_catalog.load",
  "seo.audit",
  "seo.sitemap",
  "seo.url_style",
  "ai.alt_text",
  "ai.image_edit",
  "ai.seo_fill",
])

export const SUPPORT_DENIED: readonly Rule[] = [
  // The shop's people, its owner and their roles; one's own account (support has none)
  { methods: "*", path: "/admin/users*" },
  { methods: "*", path: "/admin/invites*" },
  { methods: "*", path: "/admin/staff*" },
  // What one has read of the bell is kept on one's user record: support has none
  { methods: "*", path: "/admin/alerts/read" },
  // Payment and integration accounts, keys, outgoing events, mail server, e-invoice programs
  { methods: "*", path: "/admin/integrations/credentials*" },
  { methods: "*", path: "/admin/api-access*" },
  { methods: "*", path: "/admin/api-keys*" },
  { methods: "*", path: "/admin/webhooks*" },
  { methods: "*", path: "/admin/messaging/smtp*" },
  { methods: "*", path: "/admin/einvoice/parasut*" },
  { methods: "*", path: "/admin/einvoice/birfatura*" },
  { methods: ["POST"], path: "/admin/google/connect" },
  { methods: ["DELETE"], path: "/admin/google" },
  // Money, tax, the legal identity, 2FA and the switch, the storefront going dark
  ...SUPPORT_CLOSED_SECTIONS.map((section): Rule => ({
    methods: WRITES,
    path: `/admin/platform-settings/${section}`,
  })),
  { methods: WRITES, path: "/admin/vat-rates*" },
  { methods: "*", path: "/admin/plan*" },
  { methods: "*", path: "/admin/ai/credits/orders*" },
  // Money moved or promised, and words sent in the shop's name: they outlive the session
  // (security review M2; the session is for the looks and the catalogue)
  { methods: WRITES, path: "/admin/orders/:id/refunds*" },
  { methods: WRITES, path: "/admin/payments/:id/refund" },
  { methods: WRITES, path: "/admin/payments/:id/capture" },
  { methods: WRITES, path: "/admin/gift-cards*" },
  { methods: WRITES, path: "/admin/store-credit*" },
  { methods: WRITES, path: "/admin/payment-links*" },
  { methods: WRITES, path: "/admin/bulk-messages*" },
  { methods: WRITES, path: "/admin/legal-documents*" },
  // Customers' personal data out in bulk, or one by one past what the screens show
  { methods: ["POST"], path: "/admin/order-board/export" },
  // Medusa's own order export: every customer's name and address in one file (review M1)
  { methods: "*", path: "/admin/orders/export" },
  // Any queued job's file: an export the owner made is the owner's (review H2)
  { methods: "*", path: "/admin/async-jobs/:id/result" },
  { methods: WRITES, path: "/admin/booking-travelers/erase" },
  { methods: "*", path: "/admin/integrations/overview" },
  { methods: "*", path: "/admin/customer-export*" },
  { methods: "*", path: "/admin/customers/:id/billing-profile/reveal" },
  { methods: "*", path: "/admin/booking-travelers/:id/reveal" },
  { methods: "*", path: "/admin/booking-travelers/search" },
  { methods: "*", path: "/admin/customers/:id/privacy-requests*" },
  { methods: WRITES, path: "/admin/privacy-requests*" },
  { methods: "*", path: "/admin/invoices/:id/pdf" },
  { methods: "*", path: "/admin/invoices/:id/draft" },
  {
    methods: ["POST"],
    path: "/admin/async-jobs",
    when: (facts) => facts.jobType === undefined || !SUPPORT_JOB_TYPES.has(facts.jobType),
  },
  // Ways for the shop's data to leave it: a migration (customers too), data sent to the AI service
  { methods: "*", path: "/admin/migrations*" },
  { methods: WRITES, path: "/admin/features/ai.reviews" },
  { methods: WRITES, path: "/admin/features/ai.assistant" },
  { methods: WRITES, path: "/admin/features/ai.storefront_search" },
  // Who did what, the runs' inner records, the raw feed
  { methods: "*", path: "/admin/audit-log*" },
  { methods: "*", path: "/admin/workflows-executions*" },
  { methods: "*", path: "/admin/notifications*" },
  // Medusa Admin's menus and views for every user
  { methods: WRITES, path: "/admin/layouts*" },
  { methods: WRITES, path: "/admin/views*" },
  // The owner's switch, sessions and history
  { methods: "*", path: "/admin/support-access*" },
  // Money marked as come, and messages or prices in the shop's name (security review M-A)
  { methods: WRITES, path: "/admin/orders/:id/bank-transfer*" },
  { methods: WRITES, path: "/admin/payment-collections*" },
  { methods: WRITES, path: "/admin/draft-orders*" },
  { methods: WRITES, path: "/admin/wholesale*" },
  { methods: WRITES, path: "/admin/messaging*" },
  { methods: WRITES, path: "/admin/promotions*" },
  { methods: WRITES, path: "/admin/campaigns*" },
  { methods: WRITES, path: "/admin/price-lists*" },
  { methods: "*", path: "/admin/fraud*" },
  // Medusa's own catalogue files, mailed to their asker (the panel's are `catalog.*` jobs)
  { methods: "*", path: "/admin/products/export" },
  { methods: "*", path: "/admin/inventory-items/export" },
  { methods: "*", path: "/admin/products/import*" },
  { methods: "*", path: "/admin/products/imports*" },
]

/** Settings sections it writes: only those `allowed.ts` names, the deny list's never. */
const SECTION_WRITE = /^\/admin\/platform-settings\/([^/]+)$/

/** `/auth/*` a support session may call: signing out only. */
const SUPPORT_AUTH: readonly Rule[] = [{ methods: ["DELETE"], path: "/auth/session" }]

export type SupportDecision =
  { allowed: true } | { allowed: false; reason: "support_denied" | "support_unlisted" }

/** What the support guard reads from a request beyond the role layer's facts. */
export interface SupportFacts extends RequestFacts {
  /** A list's `limit`, when the request asks one. */
  pageSize?: number | undefined
}

const decodedPath = (path: string): string =>
  path
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

/** Whether a support session may call `method` on `path` (lower-cased, no query). */
export function decideSupport(
  method: string,
  path: string,
  facts: SupportFacts = {}
): SupportDecision {
  const verb = method.toUpperCase()
  if (path === "/auth" || path.startsWith("/auth/")) {
    return matches(SUPPORT_AUTH, verb, path, facts)
      ? { allowed: true }
      : { allowed: false, reason: "support_denied" }
  }
  // Who one is: answered for a support session by its own middleware
  if (matches(SELF, verb, path, facts)) {
    return { allowed: true }
  }
  const decoded = decodedPath(path)
  const refused = (rules: readonly Rule[]) =>
    matches(rules, verb, path, facts) || matches(rules, verb, decoded, facts)
  if (refused(REPLACED) || refused(SUPPORT_DENIED)) {
    return { allowed: false, reason: "support_denied" }
  }
  // A settings section written: only the looks' and the catalogue's, by its decoded name
  const section = SECTION_WRITE.exec(decoded)?.[1]
  if (verb !== "GET" && verb !== "HEAD" && section !== undefined) {
    return (SUPPORT_WRITE_SECTIONS as readonly string[]).includes(section)
      ? { allowed: true }
      : { allowed: false, reason: "support_denied" }
  }
  // Customers a page at a time, never the whole list in one answer
  if (
    decoded.startsWith("/admin/customers") &&
    facts.pageSize !== undefined &&
    !(facts.pageSize <= SUPPORT_PAGE_MAX)
  ) {
    return { allowed: false, reason: "support_denied" }
  }
  return matches(SUPPORT_ALLOWED, verb, path, facts)
    ? { allowed: true }
    : { allowed: false, reason: "support_unlisted" }
}

/** What the panel offers a support session: the same probes as a role's. */
export function supportCapabilities(): Record<Capability, boolean> {
  return Object.fromEntries(
    Object.entries(capabilityProbes()).map(([name, [method, path]]) => [
      name,
      decideSupport(method, path).allowed,
    ])
  ) as Record<Capability, boolean>
}
