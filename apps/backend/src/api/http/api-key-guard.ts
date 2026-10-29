import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { scopeOf } from "../../lib/api-access"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { API_KEY_SCOPES_MODULE } from "../../modules/api-key-scopes"
import type ApiKeyScopesModuleService from "../../modules/api-key-scopes/service"
import { rateLimit } from "./rate-limit"
import { rejectRequest } from "./reject"

const keyOf = (req: MedusaRequest): string | undefined => {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return auth?.actor_type === "api-key" ? auth.actor_id : undefined
}

// Each key its own budget, wherever it calls from
const keyBudget = rateLimit(() => RATE_LIMIT_PROFILES.api_key, { identity: keyOf })

/**
 * The scope layer (F11.6, adr/0039 §6): Medusa lets a secret API key call
 * every /admin route; here a key reaches only the routes its scopes list,
 * within its own rate limit. People (session, bearer) pass untouched.
 * Runs after Medusa's own authentication, which sets the actor.
 */
export async function guardApiKeys(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const keyId = keyOf(req)
  if (!keyId) {
    next()
    return
  }
  // The whole path: under a mounted matcher `req.path` is only what is left of it
  const needed = scopeOf(req.method, new URL(req.originalUrl, "http://local").pathname)
  const scopes = needed
    ? await req.scope.resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE).scopesOf(keyId)
    : []
  if (!needed || !scopes.includes(needed)) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "api_key.scope_denied" },
      "api_key_scope"
    )
    return
  }
  await keyBudget(req, res, next)
}
