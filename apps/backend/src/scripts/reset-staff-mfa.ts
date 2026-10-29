import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Turns a staff member's 2FA off from the server's shell (`medusa exec
 * ./src/scripts/reset-staff-mfa.ts <email>`): a phone lost with no
 * recovery code left, the owner's own included. Their next sign-in asks
 * for a new setup when the shop requires 2FA. Recorded as the system's.
 */
export default async function resetStaffMfa({ container, args }: ExecArgs) {
  const email = (args[0] ?? "").trim().toLowerCase()
  const auth = container.resolve(Modules.AUTH)
  const [login] = await auth.listProviderIdentities(
    { entity_id: email, provider: "emailpass" },
    { select: ["auth_identity_id"] }
  )
  const identityId = login?.auth_identity_id
  if (!email || !identityId) {
    throw new Error("reset-staff-mfa: no such login")
  }
  const factors = await auth.listAuthMfa(
    { auth_identity_id: identityId, status: ["enabled", "pending"] },
    { select: ["id"] }
  )
  for (const factor of factors) {
    await auth.disableAuthMfa({ id: factor.id })
  }
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "system",
    action: "staff.mfa_reset",
    actor_type: "system",
    resource_type: "auth_identity",
    resource_id: identityId,
    changes: { factors: factors.length },
  })
  logger.info({ event: "staff.mfa_reset", factors: factors.length })
}
