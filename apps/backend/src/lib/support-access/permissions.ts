/**
 * What a "Platform desteği" session may do (adr/0061 Ek "Destek erişimi",
 * Karar 5): what the owner may (the storefront's looks and the catalogue
 * are why it exists), less the list below: the shop's people and its
 * accounts, money and tax settings, the legal identity, customers'
 * personal data leaving in bulk, ways for data to leave the shop, the
 * audit trail, and the support switch itself. Medusa's own ways round the
 * role layer (`REPLACED`) stay closed as for everyone. Decided on the path
 * Express routes (lower-cased), refused lists matched raw and decoded, as
 * `decide` does. Queued jobs: an allow-list, so a new export is closed
 * until listed.
 */
import { capabilityProbes, matches } from "../staff/permissions"
import type { Capability } from "../staff/permissions"
import { REPLACED, SELF } from "../staff/permission-rules"
import type { Method, RequestFacts, Rule } from "../staff/permission-rules"

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
  // Customers' personal data out in bulk, or one by one past what the screens show
  { methods: ["POST"], path: "/admin/order-board/export" },
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
]

/** `/auth/*` a support session may call: signing out only. */
const SUPPORT_AUTH: readonly Rule[] = [{ methods: ["DELETE"], path: "/auth/session" }]

export type SupportDecision = { allowed: true } | { allowed: false; reason: "support_denied" }

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
  facts: RequestFacts = {}
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
  return { allowed: true }
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
