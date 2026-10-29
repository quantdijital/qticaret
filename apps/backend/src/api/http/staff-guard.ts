import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { decide, isSelfRoute } from "../../lib/staff"
import type { StaffRole } from "../../lib/staff"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

const userOf = (req: MedusaRequest): string | undefined => {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return auth?.actor_type === "user" ? auth.actor_id : undefined
}

/**
 * The signed-in staff member's role: undefined for anyone else (a key,
 * nobody), null for a user without one.
 */
export async function staffRoleOf(req: MedusaRequest): Promise<StaffRole | null | undefined> {
  const userId = userOf(req)
  return userId
    ? req.scope.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
    : undefined
}

/**
 * The role layer (F12.6, adr/0040): a staff member reaches what their role
 * allows (lib/staff/permissions.ts), on every admin request, decided on
 * the path Express routes (lower-cased: Express matches regardless of
 * case). A secret API key has its own layer (api-key-guard.ts); a request
 * without a user is left to the route (Medusa's own authentication).
 */
export async function guardStaffRoles(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const role = await staffRoleOf(req)
  if (role === undefined) {
    next()
    return
  }
  if (role === null) {
    // Removed from the staff, their session still open: who they are, nothing more
    if (isSelfRoute(req.method, routePath(req))) {
      next()
      return
    }
    rejectRequest(req, res, 403, { type: "not_allowed", message: "staff.no_role" }, "staff_no_role")
    return
  }
  const body = req.body as { type?: unknown } | undefined
  const decision = decide(role, req.method, routePath(req), {
    jobType: typeof body?.type === "string" ? body.type : undefined,
  })
  if (!decision.allowed) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "staff.forbidden" },
      `staff_role_${decision.reason}`
    )
    return
  }
  next()
}
