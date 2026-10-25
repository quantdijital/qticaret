import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { rejectRequest } from "./reject"

/**
 * For routes meant for people, not integrations: a secret API key is
 * refused. The audit log shows every staff member's IP address; until roles
 * arrive (F12) only signed-in admin users read it.
 */
export function requireUserActor(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  if (auth?.actor_type !== "user") {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "errors.users_only" },
      "user_actor_required"
    )
    return
  }
  next()
}
