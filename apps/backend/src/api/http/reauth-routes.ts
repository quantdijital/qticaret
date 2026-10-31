import type { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { requireReauth, signInCodeOnce } from "./reauth"
import { noteMfaChange } from "./mfa-notice"

const param = (req: MedusaRequest, name: string) =>
  (req.params as Record<string, string | undefined>)[name] ?? ""

const body = (req: MedusaRequest) => (req.body ?? {}) as Record<string, unknown>

const isOwner = async (req: MedusaRequest, userId: string) =>
  (await req.scope.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)) === "owner"

/**
 * F12.6 (adr/0040 §3; adr/0027's second verification): the changes a staff
 * member proves themselves again for, in the request itself: what a stolen
 * session could use to reach the shop's money or data, or to keep its hold. The route's
 * section and member come from Express's own parameters: decoded, as the
 * route reads them.
 */
export const REAUTH_ROUTES = [
  // The shop's provider accounts: details, merchant number, test mode, or gone
  {
    matcher: "/admin/integrations/credentials/:provider",
    methods: ["POST" as const, "DELETE" as const],
    middlewares: [requireReauth()],
  },
  // A new key reaches the shop's data from outside; so does a hook's address
  { matcher: "/admin/api-access", methods: ["POST" as const], middlewares: [requireReauth()] },
  { matcher: "/admin/webhooks", methods: ["POST" as const], middlewares: [requireReauth()] },
  // A new signing secret: whoever holds it can sign as the shop
  {
    matcher: "/admin/webhooks/:id/rotate-secret",
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  },
  {
    matcher: "/admin/webhooks/:id",
    methods: ["POST" as const],
    middlewares: [requireReauth((req) => body(req)["url"] !== undefined)],
  },
  // Where shoppers' transfers go; the team's 2FA turned off
  {
    matcher: "/admin/platform-settings/:section",
    methods: ["POST" as const],
    middlewares: [
      requireReauth(
        (req) =>
          param(req, "section") === "bank_transfer" ||
          (param(req, "section") === "security" && body(req)["staff_mfa_required"] === false)
      ),
    ],
  },
  // Someone new on the team: their access outlives the session that asked.
  // A resend hands out a fresh link too, an expired invitation's included
  ...["/admin/staff/invites", "/admin/staff/invites/:id/resend"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  })),
  // An owner made or unmade, an owner taken off, a member's 2FA reset
  {
    matcher: "/admin/staff/members/:id",
    methods: ["POST" as const],
    middlewares: [
      requireReauth(
        async (req) => body(req)["role"] === "owner" || (await isOwner(req, param(req, "id")))
      ),
    ],
  },
  {
    matcher: "/admin/staff/members/:id",
    methods: ["DELETE" as const],
    middlewares: [requireReauth((req) => isOwner(req, param(req, "id")))],
  },
  {
    matcher: "/admin/staff/members/:id/reset-mfa",
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  },
  // A customer's full tax id
  {
    matcher: "/admin/customers/:id/billing-profile/reveal",
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  },
  // One's own 2FA set up: without it, a stolen session would enrol its own
  // app and prove itself with that app's codes ever after. There is no
  // factor yet, so the proof is the password
  {
    matcher: "/auth/mfa/factors/:id/verify",
    methods: ["POST" as const],
    middlewares: [requireReauth(), noteMfaChange("enabled")],
  },
  // New recovery codes: a stolen session would mint its own and prove itself
  // with them. Right after the setup, its own code proves it (the panel sends it)
  {
    matcher: "/auth/mfa/recovery-codes",
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  },
  // One's own 2FA turned off (a setup left half-way is dropped without it)
  {
    matcher: "/auth/mfa/factors/:id",
    methods: ["DELETE" as const],
    middlewares: [
      requireReauth(async (req) => {
        const factor = await req.scope
          .resolve(Modules.AUTH)
          .retrieveAuthMfa(param(req, "id"), { select: ["status"] })
          .catch(() => null)
        return factor?.status === "enabled"
      }),
      noteMfaChange("disabled"),
    ],
  },
  // A sign-in's app code: once, and never again for a step-up
  {
    matcher: "/auth/mfa/challenges/:id/verify",
    methods: ["POST" as const],
    middlewares: [signInCodeOnce],
  },
]
