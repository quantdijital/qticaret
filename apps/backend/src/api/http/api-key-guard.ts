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
import { routePathKeepingCase } from "./request-path"

/** The secret API key calling, or undefined for a person (session, bearer). */
export const apiKeyOf = (req: MedusaRequest): string | undefined => {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return auth?.actor_type === "api-key" ? auth.actor_id : undefined
}

// Each key its own budget, wherever it calls from
const keyBudget = rateLimit(() => RATE_LIMIT_PROFILES.api_key, { identity: apiKeyOf })

/**
 * The scope layer (F11.6, adr/0039 §6): Medusa lets a secret API key call
 * every /admin route; here a key reaches only the routes its scopes list,
 * within its own rate limit. People (session, bearer) pass untouched.
 * Runs after Medusa's own authentication, which sets the actor.
 *
 * The path is the one Express routes by, as written: a URL parser would
 * fold `/admin/gift-cards/%2e%2e/orders` into `/admin/orders` while
 * Express runs the gift card route. A key reads each route's own fields
 * only: admin routes expand links freely through `fields` (a variant's
 * unit cost, a payment's data), so a key may not name any.
 */
export async function guardApiKeys(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const keyId = apiKeyOf(req)
  if (!keyId) {
    next()
    return
  }
  const needed = scopeOf(req.method, routePathKeepingCase(req))
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
  if (req.query["fields"] !== undefined) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "api_key.fields_not_allowed" },
      "api_key_fields"
    )
    return
  }
  await keyBudget(req, res, next)
}
