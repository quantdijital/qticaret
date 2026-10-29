import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { rejectRequest } from "./reject"

/**
 * For routes meant for people, not integrations: a secret API key is
 * refused. Which people is the role layer's (staff-guard.ts, adr/0040).
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
