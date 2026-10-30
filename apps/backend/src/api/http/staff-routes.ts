import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostStaffInviteInfo,
  AdminPostStaffAccept,
  AdminPostStaffInvite,
  AdminPostStaffRole,
} from "../admin/staff/validators"
import { requireUserActor } from "./actor"
import { answerAsMissing } from "./require-feature"

function closeCoreInviteAccept(req: MedusaRequest, res: MedusaResponse) {
  answerAsMissing(req, res, "core_invite_accept_closed")
}

/**
 * F12.6 (adr/0040): the team. Who may call each route is the role table's
 * (lib/staff/permissions.ts); these check that a person calls and what
 * they send. An invitation's page and its acceptance come before an
 * account: the token, then a login registered for the invited address.
 */
export const STAFF_ROUTES = [
  {
    matcher: "/admin/staff",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/admin/staff/members/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostStaffRole)],
  },
  {
    matcher: "/admin/staff/members/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/staff/members/:id/reset-mfa",
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/staff/invites",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostStaffInvite)],
  },
  {
    matcher: "/admin/staff/invites/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/staff/invites/:id/resend",
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/staff/invites/info",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStaffInviteInfo)],
  },
  // Medusa's own acceptance takes any login for any invitation and gives
  // no role: `/admin/staff/invites/accept` replaces it (adr/0040 §4)
  {
    matcher: "/admin/invites/accept",
    methods: ["POST" as const],
    middlewares: [closeCoreInviteAccept],
  },
  {
    matcher: "/admin/staff/invites/accept",
    methods: ["POST" as const],
    middlewares: [
      authenticate("user", ["bearer"], { allowUnregistered: true }),
      validateAndTransformBody(AdminPostStaffAccept),
    ],
  },
]
