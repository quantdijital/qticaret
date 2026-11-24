import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"
import { errorSummary, logger } from "../../lib/logging"
import { mfaAvailable } from "./staff-guard"

interface ChallengedLogin {
  mfa_required: true
  token: string
}

const isChallenged = (body: unknown): body is ChallengedLogin =>
  typeof body === "object" &&
  body !== null &&
  (body as { mfa_required?: unknown }).mfa_required === true &&
  typeof (body as { token?: unknown }).token === "string"

/** The identity the challenge's actorless token names (Medusa signed it in this same request). */
function identityOf(token: string): string | null {
  const payload = token.split(".")[1]
  if (!payload) {
    return null
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      auth_identity_id?: unknown
    }
    return typeof claims.auth_identity_id === "string" && claims.auth_identity_id
      ? claims.auth_identity_id
      : null
  } catch {
    return null
  }
}

/**
 * The full sign-in token Medusa would give once the challenge is passed,
 * without the challenge: marked as having no 2FA, so neither Medusa's
 * authentication nor ours asks for it. Null when the identity has no user.
 */
async function tokenWithoutChallenge(req: MedusaRequest, token: string): Promise<string | null> {
  const id = identityOf(token)
  if (!id) {
    return null
  }
  const authIdentity = await req.scope
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(id, { relations: ["provider_identities"] })
  if (!authIdentity.app_metadata?.["user_id"]) {
    return null
  }
  const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  if (!http.jwtSecret) {
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
    void tokenWithoutChallenge(req, body.token).then(
      (token) => json(token ? { token } : body),
      (error: unknown) => {
        logger.warn({ event: "staff.mfa_off_login_failed", err: errorSummary(error) })
        json(body)
      }
    )
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
