import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { AdminPostOrderNote } from "../admin/orders/[id]/notes/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/** Messages a staff member sends again: each reaches a customer's inbox or phone. */
const RESEND: RateLimitProfile = {
  name: "order_message_resend",
  perIdentityAnyIp: { max: 30, windowMs: 60 * 60 * 1000 },
}

/** Notes e-mailed to customers (Batch 9 / O3): staff's own words in a customer's inbox. */
const NOTE_TO_CUSTOMER: RateLimitProfile = {
  name: "order_note_to_customer",
  perIdentityAnyIp: { max: 20, windowMs: 60 * 60 * 1000 },
}

/** Only a note that goes to the customer spends the budget; the team's own notes do not. */
const limitNoteToCustomer = rateLimit(
  (req) =>
    (req.validatedBody as { notify_customer?: boolean } | undefined)?.notify_customer === true
      ? NOTE_TO_CUSTOMER
      : null,
  { identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id }
)

/**
 * F12.8: the team's notes on an order and what its customer was sent.
 * People only: a note has an author, and an integration key reads neither.
 */
export const COMMUNICATION_ROUTES = [
  {
    matcher: "/admin/orders/:id/notes",
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  },
  {
    matcher: "/admin/orders/:id/notes",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(AdminPostOrderNote),
      limitNoteToCustomer,
    ],
  },
  {
    matcher: "/admin/orders/:id/notes/:note_id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  ...["/admin/orders/:id/messages", "/admin/customers/:id/messages"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  })),
  // 2026-11-06: an order's message again, its template only (no text of staff's own)
  {
    matcher: "/admin/orders/:id/messages/:message_id/resend",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RESEND, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(z.object({}).strict()),
    ],
  },
]
