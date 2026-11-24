import { getAuthContextFromJwtToken } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ConfigModule } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"
import { errorSummary, logger } from "../../lib/logging"
import { mfaAvailable } from "./staff-guard"

interface ChallengedLogin {
  mfa_required: true
  token: string
}

type HttpConfig = ConfigModule["projectConfig"]["http"]

const isChallenged = (body: unknown): body is ChallengedLogin =>
  typeof body === "object" &&
  body !== null &&
  (body as { mfa_required?: unknown }).mfa_required === true &&
  typeof (body as { token?: unknown }).token === "string"

/**
 * The identity the challenge's actorless token names, its signature checked
 * as Medusa's authentication checks it (same key, same options); null when
 * it does not verify.
 */
function identityOf(token: string, http: HttpConfig): string | null {
  const claims = getAuthContextFromJwtToken(
    `Bearer ${token}`,
    http.jwtSecret ?? "",
    ["bearer"],
    ["user"],
    http.jwtPublicKey,
    http.jwtVerifyOptions ?? http.jwtOptions
  )
  const id = claims?.auth_identity_id
  return typeof id === "string" && id ? id : null
}

/**
 * The full sign-in token Medusa would give once the challenge is passed,
 * without the challenge: marked as having no 2FA, so neither Medusa's
 * authentication nor ours asks for it. Null when the token does not verify
 * or the identity has no user.
 */
async function tokenWithoutChallenge(req: MedusaRequest, token: string): Promise<string | null> {
  const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  if (!http.jwtSecret) {
    return null
  }
  const id = identityOf(token, http)
  if (!id) {
    return null
  }
  const authIdentity = await req.scope
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(id, { relations: ["provider_identities"] })
  if (!authIdentity.app_metadata?.["user_id"]) {
    return null
  }
  return generateJwtTokenForAuthIdentity(
    {
      authIdentity,
      actorType: "user",
      authProvider: "emailpass",
      container: req.scope,
      mfaEnabled: false,
    },
    { secret: http.jwtSecret, expiresIn: http.jwtExpiresIn, options: http.jwtOptions }
  )
}

/** The challenged answer sent on: the plain token when there is one, else the challenge. */
async function sendWithoutChallenge(
  req: MedusaRequest,
  res: MedusaResponse,
  json: MedusaResponse["json"],
  body: ChallengedLogin
): Promise<void> {
  try {
    const token = await tokenWithoutChallenge(req, body.token)
    json(token ? { token } : body)
  } catch (error) {
    logger.warn({ event: "staff.mfa_off_login_failed", err: errorSummary(error) })
    if (!res.headersSent) {
      json(body)
    }
  }
}

/**
 * `POST /auth/user/emailpass` on a developer's machine with `ADMIN_MFA=off`
 * (lib/staff/mfa.ts): Medusa's auth module challenges every login with an
 * enabled factor, whatever its options, so a factor set up earlier would
 * still ask for its code. Here the challenge's answer becomes a plain
 * sign-in. Where the shop runs `mfaAvailable()` is always true and this
 * passes straight through; the factor itself stays, for when 2FA is on again.
 */
export function skipMfaChallengeWhenOff(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (mfaAvailable()) {
    next()
    return
  }
  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    res.json = json
    if (res.statusCode >= 400 || !isChallenged(body)) {
      return json(body)
    }
    void sendWithoutChallenge(req, res, json, body)
    return res
  }
  next()
}

export const MFA_OFF_LOGIN_ROUTES = [
  {
    matcher: "/auth/user/emailpass",
    methods: ["POST" as const],
    middlewares: [skipMfaChallengeWhenOff],
  },
]
