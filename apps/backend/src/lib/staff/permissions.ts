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

export const STAFF_ROLES = ["owner", "admin", "operations", "readonly"] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

/** The roles an invitation gives; an owner is made by an owner, from the team (adr/0040 §3). */
export const INVITABLE_ROLES = ["admin", "operations", "readonly"] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

type Method = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE"

interface Rule {
  methods: readonly Method[] | "*"
  /** `:name` is one segment; a trailing `*` takes the path and everything below it. */
  path: string
  /** Allowed only when this holds too (a job's type). */
  when?: (context: RequestFacts) => boolean
}

export interface RequestFacts {
  /** `type` of a queued job's body, when there is one. */
  jobType?: string | undefined
  /** The `channel` a notification list asks for, when it asks for one alone. */
  notificationChannel?: string | undefined
}

const WRITES: readonly Method[] = ["POST", "PUT", "PATCH", "DELETE"]
const READS = new Set<string>(["GET", "HEAD", "OPTIONS"])

// Jobs that only read and write a file: an export of what the role may read
const READ_JOBS = new Set(["report.export", "catalog.export"])

/** Any role, its own: who it is and what it may do. */
const SELF: readonly Rule[] = [
  { methods: ["GET"], path: "/admin/users/me" },
  { methods: ["GET"], path: "/admin/staff/me" },
]

/**
 * Medusa's own ways round this layer, for no one, the owner included: a user
 * deleted here skips the last-owner guard, the step-up and the role's
 * removal; an invitation made here carries no role. `/admin/staff` does both.
 */
const REPLACED: readonly Rule[] = [
  // Only closes the record, the data left in it: erasure is a KVKK request's (F13.5)
  { methods: ["DELETE"], path: "/admin/customers/:id" },
  { methods: ["DELETE"], path: "/admin/users/:id" },
  { methods: ["POST"], path: "/admin/invites" },
  { methods: ["POST"], path: "/admin/invites/:id/resend" },
  { methods: ["DELETE"], path: "/admin/invites/:id" },
]

/** The owner's alone (adr/0027, adr/0040 §1). */
const OWNER_ONLY: readonly Rule[] = [
  // The shop's provider accounts; their connection check stays the admin's
  { methods: WRITES, path: "/admin/integrations/credentials/:provider" },
  // Keys and outgoing events: ways for the shop's data to leave it
  { methods: "*", path: "/admin/api-access*" },
  { methods: "*", path: "/admin/api-keys*" },
  { methods: WRITES, path: "/admin/webhooks*" },
  { methods: WRITES, path: "/admin/platform-settings/accounting" },
  // Which program issues the invoices: the buyers' details go to it (adr/0034)
  { methods: WRITES, path: "/admin/platform-settings/invoicing" },
  // Connecting the company; checking it stays the admin's, as with provider accounts
  { methods: WRITES, path: "/admin/einvoice/parasut" },
  { methods: ["POST"], path: "/admin/google/connect" },
  { methods: ["DELETE"], path: "/admin/google" },
  // Where shoppers' transfers go
  { methods: WRITES, path: "/admin/platform-settings/bank_transfer" },
  // A shop's data moved in from its old platform, its customers too (F14, adr/0042 §9)
  { methods: "*", path: "/admin/migrations*" },
  // Whether the team must pass 2FA (adr/0040)
  { methods: WRITES, path: "/admin/platform-settings/security" },
  // The shop's people
  { methods: WRITES, path: "/admin/users*" },
  { methods: "*", path: "/admin/invites*" },
  { methods: WRITES, path: "/admin/staff*" },
]

/** Not even read by `operations` and `readonly`: who did what, the accounts, the people. */
const PRIVATE: readonly Rule[] = [
  { methods: "*", path: "/admin/audit-log*" },
  { methods: "*", path: "/admin/integrations/credentials*" },
  { methods: "*", path: "/admin/einvoice/parasut*" },
  // An invoice's contents: the buyer and their tax id (adr/0034 §9)
  { methods: "*", path: "/admin/invoices/:id/draft" },
  { methods: "*", path: "/admin/invoices/:id/pdf" },
  // What each provider failed at: the shop's set-up, for those who set it up
  { methods: "*", path: "/admin/integrations/overview" },
  { methods: "*", path: "/admin/webhooks*" },
  { methods: "*", path: "/admin/users*" },
  { methods: "*", path: "/admin/staff*" },
  // A run's steps keep what they read: customers, addresses, payments
  { methods: "*", path: "/admin/workflows-executions*" },
  // Medusa's sent messages carry each customer's address: the team's own
  // feed (the panel's bell) is the one channel the others read
  {
    methods: "*",
    path: "/admin/notifications",
    when: (facts) => facts.notificationChannel !== "feed",
  },
  { methods: "*", path: "/admin/notifications/:id" },
]

const readJob: Rule = {
  methods: ["POST"],
  path: "/admin/async-jobs",
  when: (facts) => facts.jobType !== undefined && READ_JOBS.has(facts.jobType),
}

/** What `operations` writes: the day's orders, parcels, returns, stock and moderation. */
const OPERATIONS_WRITES: readonly Rule[] = [
  // An order's email and addresses (Medusa's update), and shipping it
  { methods: ["POST"], path: "/admin/orders/:id" },
  { methods: ["POST"], path: "/admin/orders/:id/ship" },
  { methods: ["POST"], path: "/admin/order-board/ship" },
  { methods: ["POST"], path: "/admin/order-board/deliver" },
  { methods: ["POST"], path: "/admin/orders/:id/return-requests" },
  // The team's notes; removing another's is the owner's (the workflow decides)
  { methods: ["POST"], path: "/admin/orders/:id/notes" },
  { methods: ["DELETE"], path: "/admin/orders/:id/notes/:note_id" },
  { methods: ["POST"], path: "/admin/orders/:id/fulfillments*" },
  { methods: ["POST"], path: "/admin/fulfillments*" },
  // A return asked for: taken in, approved or refused; giving money back is the admin's
  { methods: ["POST"], path: "/admin/return-requests/:id/approve" },
  { methods: ["POST"], path: "/admin/return-requests/:id/receive" },
  { methods: ["POST"], path: "/admin/return-requests/:id/reject" },
  // Stock on the shelf
  { methods: ["POST"], path: "/admin/inventory-items*" },
  { methods: ["POST", "DELETE"], path: "/admin/reservations*" },
  { methods: ["POST"], path: "/admin/stock-items/:id/watch" },
  // Reviews and questions
  { methods: ["POST"], path: "/admin/product-reviews/moderate" },
  { methods: ["POST"], path: "/admin/product-questions/moderate" },
  { methods: ["POST"], path: "/admin/product-answers/moderate" },
  { methods: ["POST"], path: "/admin/product-questions/:id/answer" },
  readJob,
]

const READONLY_WRITES: readonly Rule[] = [readJob]

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
  team: ["GET", "/admin/staff"],
  staff: ["POST", "/admin/staff/members/:id"],
  audit: ["GET", "/admin/audit-log"],
  taxId: ["POST", "/admin/customers/:id/billing-profile/reveal"],
  // F13.5: recording and answering a customer's KVKK requests
  privacy: ["POST", "/admin/customers/:id/privacy-requests"],
  // F8: an invoice's PDF, the buyer and their tax id on it
  invoices: ["GET", "/admin/invoices/:id/pdf"],
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
