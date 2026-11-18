/**
 * The route lists each staff role is decided by (adr/0040); `permissions.ts`
 * reads them in order: self, replaced, owner only, private, then the
 * writes `operations` and `readonly` are allowed.
 */

import { findAiTask } from "../ai/registry/tasks"

export type Method = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface Rule {
  methods: readonly Method[] | "*"
  /** `:name` is one segment; a trailing `*` takes the path and everything below it. */
  path: string
  /** Allowed only when this holds too (a job's type). */
  when?: (context: RequestFacts) => boolean
}

export interface RequestFacts {
  /** `type` of a queued job's body, when there is one. */
  jobType?: string | undefined
  /** The type of the API key a `DELETE /admin/api-keys/:id` names, when it is one we have. */
  apiKeyType?: string | undefined
  /** `task` of an AI suggestion's body (`POST /admin/ai/suggestions`), when there is one. */
  aiTask?: string | undefined
}

const WRITES: readonly Method[] = ["POST", "PUT", "PATCH", "DELETE"]

// Jobs that only read and write a file: an export of what the role may read
const READ_JOBS = new Set(["report.export", "catalog.export"])

/** Any role, its own: who it is and what it may do. */
export const SELF: readonly Rule[] = [
  { methods: ["GET"], path: "/admin/users/me" },
  { methods: ["GET"], path: "/admin/staff/me" },
]

/**
 * Any role, about its own account (the owner, 2026-11-06): the profile, the
 * password, the login address, one's other sessions. Unlike `SELF` these
 * pass the 2FA gate first and ask for a role: someone taken off the team
 * changes nothing. The handlers act on the caller alone, never on an id
 * from the request.
 */
export const OWN: readonly Rule[] = [
  // What one has read of the shop's alerts is one's own (adr/0020)
  { methods: ["POST"], path: "/admin/alerts/read" },
  { methods: ["GET", "POST"], path: "/admin/staff/me/profile" },
  { methods: ["POST"], path: "/admin/staff/me/password" },
  { methods: ["POST"], path: "/admin/staff/me/email" },
  { methods: ["POST"], path: "/admin/staff/me/email/cancel" },
  { methods: ["POST"], path: "/admin/staff/me/email/confirm" },
  { methods: ["GET"], path: "/admin/staff/me/sessions" },
  { methods: ["POST"], path: "/admin/staff/me/sessions/end-others" },
]

/**
 * Medusa's own ways round this layer, for no one, the owner included: a user
 * deleted here skips the last-owner guard, the step-up and the role's
 * removal; an invitation made here carries no role. `/admin/staff` does both.
 */
export const REPLACED: readonly Rule[] = [
  // Only closes the record, the data left in it: erasure is a KVKK request's (F13.5)
  { methods: ["DELETE"], path: "/admin/customers/:id" },
  { methods: ["DELETE"], path: "/admin/users/:id" },
  { methods: ["POST"], path: "/admin/invites" },
  { methods: ["POST"], path: "/admin/invites/:id/resend" },
  { methods: ["DELETE"], path: "/admin/invites/:id" },
  // A file under a media record (a product's image, the logo, the share image) deleted
  // round it would leave the record pointing at nothing; the media cleanup removes them
  { methods: ["DELETE"], path: "/admin/uploads/:id" },
  // A secret key deleted round `/admin/api-access/:id` keeps its scopes and has no
  // `api_key.deleted` entry; a publishable key (the storefront's) is Medusa's to delete
  {
    methods: ["DELETE"],
    path: "/admin/api-keys/:id",
    when: (facts) => facts.apiKeyType !== "publishable",
  },
  // KDV rates and the product types that carry them (adr/0007): `/admin/vat-rates`
  // keeps a rate products are on and the default, which these would delete
  { methods: WRITES, path: "/admin/tax-rates*" },
  { methods: WRITES, path: "/admin/tax-regions*" },
  { methods: WRITES, path: "/admin/product-types*" },
]

/** The owner's alone (adr/0027, adr/0040 §1). */
export const OWNER_ONLY: readonly Rule[] = [
  // The shop's provider accounts; their connection check stays the admin's
  { methods: WRITES, path: "/admin/integrations/credentials/:provider" },
  // Keys and outgoing events: ways for the shop's data to leave it
  { methods: "*", path: "/admin/api-access*" },
  { methods: "*", path: "/admin/api-keys*" },
  { methods: WRITES, path: "/admin/webhooks*" },
  { methods: WRITES, path: "/admin/platform-settings/accounting" },
  // The KDV rates the shop charges and declares (adr/0007 Ek 2026-11-04)
  { methods: WRITES, path: "/admin/vat-rates*" },
  // Which program issues the invoices: the buyers' details go to it (adr/0034)
  { methods: WRITES, path: "/admin/platform-settings/invoicing" },
  // Connecting the company; checking it stays the admin's, as with provider accounts
  { methods: WRITES, path: "/admin/einvoice/parasut" },
  // BirFatura's token hands every waiting buyer's details to whoever holds it (adr/0072 §3)
  { methods: WRITES, path: "/admin/einvoice/birfatura*" },
  // Customers' reviews and questions sent to the AI service (adr/0071 Aşama 9)
  { methods: WRITES, path: "/admin/features/ai.reviews" },
  { methods: ["POST"], path: "/admin/google/connect" },
  { methods: ["POST"], path: "/admin/google/reviews/connect" },
  { methods: ["DELETE"], path: "/admin/google" },
  // Where shoppers' transfers go
  { methods: WRITES, path: "/admin/platform-settings/bank_transfer" },
  // Every customer's name, address and phone in one file: the order list's export
  { methods: ["POST"], path: "/admin/order-board/export" },
  // A shop's data moved in from its old platform, its customers too (F14, adr/0042 §9)
  { methods: "*", path: "/admin/migrations*" },
  // Whether the team must pass 2FA (adr/0040)
  { methods: WRITES, path: "/admin/platform-settings/security" },
  // Where the shop goes dark: maintenance or "coming soon" (adr/0053); its
  // bypass link stays the admin's, as a draft's preview link does
  { methods: WRITES, path: "/admin/platform-settings/maintenance" },
  // How far an admin may discount a link, and whether a link's order is paid
  // at the door (adr/0051): an admin would otherwise raise their own limit
  { methods: WRITES, path: "/admin/platform-settings/payment_links" },
  // Medusa Admin's menus and saved table views for every user (its `is_default`);
  // the panel has its own, Medusa Admin is off (the F15 audit)
  { methods: WRITES, path: "/admin/layouts*" },
  { methods: WRITES, path: "/admin/views*" },
  // The shop's people
  { methods: WRITES, path: "/admin/users*" },
  { methods: "*", path: "/admin/invites*" },
  { methods: WRITES, path: "/admin/staff*" },
]

/** Not even read by `operations` and `readonly`: who did what, the accounts, the people. */
export const PRIVATE: readonly Rule[] = [
  { methods: "*", path: "/admin/audit-log*" },
  { methods: "*", path: "/admin/integrations/credentials*" },
  // A test e-mail through the shop's own mail server, as its connection check (adr/0036 Ek 2026-11-10)
  { methods: "*", path: "/admin/messaging/smtp*" },
  { methods: "*", path: "/admin/einvoice/parasut*" },
  { methods: "*", path: "/admin/einvoice/birfatura*" },
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
  // Medusa's sent messages carry each customer's address, and its feed holds every
  // alert, a wholesaler's order too: the others read the team's alerts through
  // `/admin/alerts` (the panel's bell), which leaves out what their role does not see
  { methods: "*", path: "/admin/notifications" },
  { methods: "*", path: "/admin/notifications/:id" },
  // Who the shop turns away, and why (adr/0044 §4)
  { methods: "*", path: "/admin/fraud/blocks*" },
  // The package, its use and what the shop owes the platform (adr/0061 Ek C14): owner and admin
  { methods: "*", path: "/admin/plan" },
  // The AI core's use and estimated cost (adr/0071 §6): owner and admin; the services list is everyone's
  { methods: "*", path: "/admin/ai/usage" },
  // The open suggestions to review (docs/22 "Aşama 5"): the task's roles; the route checks them too
  { methods: ["GET"], path: "/admin/ai/suggestions" },
  // Wholesalers, their levels and prices (ADR-0068 §9): owner and admin; operations sees orders
  { methods: "*", path: "/admin/wholesale*" },
]

/**
 * Read by `operations` but not by `readonly` (2026-11-06): the carts left
 * behind name people who did not buy and how to reach them; they are for
 * those who follow them up.
 */
export const NOT_READONLY: readonly Rule[] = [{ methods: "*", path: "/admin/abandoned-carts*" }]

const readJob: Rule = {
  methods: ["POST"],
  path: "/admin/async-jobs",
  when: (facts) => facts.jobType !== undefined && READ_JOBS.has(facts.jobType),
}

// One's own export stopped: the route lets its asker (or the owner) only
const cancelJob: Rule = { methods: ["POST"], path: "/admin/async-jobs/:id/cancel" }

/**
 * An AI suggestion of a task whose roles name `operations` (adr/0071 §6;
 * Aşama 9: a review's summary, a reply and an answer drafted). The route is
 * shared by every task, so the workflow checks the task's roles again; a
 * decision on one is checked there against the suggestion's own task.
 */
const operationsAiTask = (facts: RequestFacts): boolean =>
  facts.aiTask !== undefined && (findAiTask(facts.aiTask)?.roles.includes("operations") ?? false)

const aiSuggestion: Rule = {
  methods: ["POST"],
  path: "/admin/ai/suggestions",
  when: operationsAiTask,
}

/** What `operations` writes: the day's orders, parcels, returns, stock and moderation. */
export const OPERATIONS_WRITES: readonly Rule[] = [
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
  // A return asked for: taken in, approved or refused, an approval taken back; giving
  // money back is the admin's
  { methods: ["POST"], path: "/admin/return-requests/:id/approve" },
  { methods: ["POST"], path: "/admin/return-requests/:id/cancel" },
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
  // The shop's reply under a review, as a question's answer
  { methods: ["POST", "DELETE"], path: "/admin/product-reviews/:id/reply" },
  // A Google review taken off the storefront or put back (adr/0058), and the shop's
  // reply to it, as a product question's answer (adr/0058 Ek 2026-11-06)
  { methods: ["POST"], path: "/admin/google/reviews/items/:id" },
  { methods: ["POST", "DELETE"], path: "/admin/google/reviews/items/:id/reply" },
  // Contact form messages marked answered (adr/0047); deleting one is the admin's
  { methods: ["POST"], path: "/admin/contact-messages/:id" },
  // A payment link for a customer in the DMs, without a discount (the workflow refuses
  // one), and sending it; cancelling or extending one is the admin's (adr/0051 §8)
  { methods: ["POST"], path: "/admin/payment-links" },
  { methods: ["POST"], path: "/admin/payment-links/preview" },
  { methods: ["POST"], path: "/admin/payment-links/:id/resend" },
  // A customer's details, addresses and the team's note on them, and a guest added by
  // hand (2026-11-06); a member's e-mail, erasure and consent are not among these
  { methods: ["POST"], path: "/admin/customers" },
  { methods: ["POST"], path: "/admin/customers/:id" },
  { methods: ["POST"], path: "/admin/customers/:id/note" },
  { methods: ["POST"], path: "/admin/customers/:id/addresses" },
  { methods: ["POST", "DELETE"], path: "/admin/customers/:id/addresses/:address_id" },
  // An order's message sent again, from its templates only (2026-11-06)
  { methods: ["POST"], path: "/admin/orders/:id/messages/:message_id/resend" },
  // A cart left behind, reminded by e-mail where its shopper consented (2026-11-06)
  { methods: ["POST"], path: "/admin/abandoned-carts/:id/remind" },
  // AI on reviews and questions only (adr/0071 §6, Aşama 9); the workflow checks the task again
  aiSuggestion,
  { methods: ["POST"], path: "/admin/ai/suggestions/:id/accept" },
  { methods: ["POST"], path: "/admin/ai/suggestions/:id/dismiss" },
  readJob,
  cancelJob,
]

export const READONLY_WRITES: readonly Rule[] = [readJob, cancelJob]
