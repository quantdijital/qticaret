import { randomBytes } from "node:crypto"
import type { Reply } from "../fake-routes"

/**
 * Paraşüt's OAuth2 as its API v4 describes it (apidocs.parasut.com
 * swagger.json): `POST /oauth/token` with the `password`,
 * `authorization_code` or `refresh_token` grant; an access token lasts two
 * hours, and each refresh hands out a new refresh token, the old one dead.
 */

export interface FakeParasutClient {
  clientId: string
  clientSecret: string
}

export interface FakeParasutUser {
  username: string
  password: string
}

/** Paraşüt's redirect for a client that has none of its own: the code is shown to be copied. */
export const OOB_REDIRECT = "urn:ietf:wg:oauth:2.0:oob"

const token = (kind: string) => `${kind}-${randomBytes(16).toString("hex")}`

const refused = (error: string): Reply => ({ status: 401, body: { error } })

/** The live tokens and codes, as a local Paraşüt keeps them between runs. */
export interface OauthState {
  access: [string, number][]
  refresh: string[]
  codes: string[]
}

export function createOauth(
  client: FakeParasutClient,
  user: FakeParasutUser,
  options: { expiresIn: number; now: () => number }
) {
  /** Live access tokens and when each dies. */
  const access = new Map<string, number>()
  const refresh = new Set<string>()
  const codes = new Set<string>()

  const issue = (): Reply => {
    const accessToken = token("erisim")
    const refreshToken = token("yenileme")
    access.set(accessToken, options.now() + options.expiresIn * 1000)
    refresh.add(refreshToken)
    return {
      body: {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: options.expiresIn,
        refresh_token: refreshToken,
        created_at: Math.floor(options.now() / 1000),
      },
    }
  }

  /** The token endpoint, its fields form-encoded or JSON. */
  function grant(fields: Record<string, string>): Reply {
    if (
      fields["client_id"] !== client.clientId ||
      fields["client_secret"] !== client.clientSecret
    ) {
      return refused("invalid_client")
    }
    switch (fields["grant_type"] ?? "") {
      case "password":
        return fields["username"] === user.username && fields["password"] === user.password
          ? issue()
          : refused("invalid_grant")
      case "authorization_code": {
        const code = fields["code"] ?? ""
        if (fields["redirect_uri"] !== OOB_REDIRECT || !codes.delete(code)) {
          return refused("invalid_grant")
        }
        return issue()
      }
      case "refresh_token": {
        // A refresh token works once: the next one comes with the answer
        if (!refresh.delete(fields["refresh_token"] ?? "")) {
          return refused("invalid_grant")
        }
        return issue()
      }
      default:
        return { status: 400, body: { error: "unsupported_grant_type" } }
    }
  }

  return {
    grant,
    /** A code as Paraşüt's authorize page shows it after the user allows the platform. */
    issueCode: (): string => {
      // As Paraşüt's authorize page shows one: 43 URL-safe characters
      const code = randomBytes(32).toString("base64url")
      codes.add(code)
      return code
    },
    /** Whether a bearer token is live. */
    allows: (bearer: string | undefined): boolean => {
      const dies = access.get(bearer?.replace(/^Bearer /, "") ?? "")
      return dies !== undefined && dies > options.now()
    },
    /** Kills every access token, as two hours passing would. */
    expireAll: () => {
      access.clear()
    },
    /** Kills every refresh token, as the user revoking the platform would. */
    revokeAll: () => {
      access.clear()
      refresh.clear()
    },
    snapshot: (): OauthState => ({
      access: [...access.entries()],
      refresh: [...refresh],
      codes: [...codes],
    }),
    restore: (state: OauthState) => {
      state.access.forEach(([key, dies]) => access.set(key, dies))
      state.refresh.forEach((key) => refresh.add(key))
      state.codes.forEach((code) => codes.add(code))
    },
  }
}
