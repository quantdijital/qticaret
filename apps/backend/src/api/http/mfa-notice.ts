import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import type { StaffMfaVars } from "../../lib/messaging/templates"
import { sendMessageWorkflow } from "../../workflows/messaging/send-message"

/**
 * Tells a staff member their 2FA changed (Y13), by e-mail to their own
 * login: a change they did not make is seen at once. Never awaited by
 * the request; a failure is logged.
 */
export function tellMfaChanged(
  container: MedusaContainer,
  userId: string,
  change: StaffMfaVars["change"]
) {
  sendMessageWorkflow(container)
    .run({
      input: {
        template: "staff.mfa_changed",
        resource_id: userId,
        key: `${change}:${String(Date.now())}`,
        extra: { change },
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "staff.mfa_notice_failed", err: errorSummary(error) })
    })
}

const staffOf = (req: MedusaRequest) => {
  const context = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return context?.actor_type === "user" && context.actor_id ? context.actor_id : null
}

/**
 * On Medusa's own factor routes (2.21.2 emits no event for them): once
 * the answer is 200, the member is told. A factor turned off counts only
 * when it was on: a setup left half-way is dropped without a word.
 */
export function noteMfaChange(change: "enabled" | "disabled") {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const userId = staffOf(req)
      const factorId = (req.params as Record<string, string | undefined>)["id"] ?? ""
      const counts =
        change === "enabled" ||
        (await req.scope
          .resolve(Modules.AUTH)
          .retrieveAuthMfa(factorId, { select: ["status"] })
          .then((factor) => factor.status === "enabled")
          .catch(() => false))
      if (userId && counts) {
        res.on("finish", () => {
          if (res.statusCode === 200) {
            tellMfaChanged(req.scope, userId, change)
          }
        })
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
