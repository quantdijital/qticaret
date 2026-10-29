import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import type { Env } from "../../lib/env"
import { decide, isSelfRoute, staffMfaPolicy } from "../../lib/staff"
import type { StaffRole } from "../../lib/staff"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SecuritySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

const userOf = (req: MedusaRequest): string | undefined => {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return auth?.actor_type === "user" ? auth.actor_id : undefined
}

// The key cannot change while the process runs; `ADMIN_MFA` is read per request
let env: Env | undefined

/** Whether this environment can ask for 2FA (lib/staff/mfa.ts). */
export const mfaAvailable = (): boolean => staffMfaPolicy((env ??= parseEnv())) === "required"

/** Whether staff must pass 2FA: the environment can ask it, and the owner's switch is on. */
export async function mfaRequired(req: MedusaRequest): Promise<boolean> {
  if (!mfaAvailable()) {
    return false
  }
  const security = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("security")) as unknown as SecuritySettings
  return security.staff_mfa_required
}

/** Whether this session passed its 2FA challenge (Medusa sets it when the code is verified). */
export const mfaPassed = (req: MedusaRequest): boolean =>
  Boolean((req as Partial<AuthenticatedMedusaRequest>).auth_context?.mfa_challenge_completed_at)

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
 * The role layer (F12.6, adr/0040): a staff member who passed 2FA reaches
 * what their role allows (lib/staff/permissions.ts), on every admin request, decided on
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
  // 2FA before anything else (adr/0040 §2): a session that has not passed it
  // reaches who it is, so the panel can take it to the setup
  if (!mfaPassed(req) && !isSelfRoute(req.method, routePath(req)) && (await mfaRequired(req))) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "staff.mfa_required" },
      "staff_mfa_required"
    )
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
