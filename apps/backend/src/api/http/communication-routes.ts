import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { AdminPostOrderNote } from "../admin/orders/[id]/notes/validators"
import { requireUserActor } from "./actor"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

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
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostOrderNote)],
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
]
