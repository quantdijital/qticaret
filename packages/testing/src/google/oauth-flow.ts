import { createHash, randomBytes } from "node:crypto"
import { loadState, saveState } from "../dev/state-file"

/**
 * Google's OAuth web server flow as the stand-in plays it (F10 M13): the
 * consent screen (a page in a browser, or `consent` in a test), codes
 * bound to their PKCE challenge and redirect, refresh and access tokens
 * each with the scopes the shop allowed. Like Google, with
 * `include_granted_scopes=true` a new token also carries what the shop
 * allowed before; revoking a token ends every grant. With a state file,
 * refresh tokens and grants outlive a restart.
 */

export interface OauthClient {
  clientId: string
  clientSecret: string
}

interface Saved {
  refresh: [string, string][]
  granted: string[]
}

const randomId = (bytes = 16) => randomBytes(bytes).toString("base64url")

/** The scope every connection asks: the Merchant API's (what tells the platform's request). */
const CONTENT = "https://www.googleapis.com/auth/content"

export function oauthFlow(client: OauthClient, email: string, stateFile?: string) {
  const codes = new Map<string, { challenge: string; redirectUri: string; scope: string }>()
  const saved = loadState(stateFile) as Saved | null
  // Each token with the scopes the shop allowed
  const refreshTokens = new Map<string, string>(saved?.refresh ?? [])
  const accessTokens = new Map<string, string>()
  const granted = new Set<string>(saved?.granted ?? [])
  const revoked: string[] = []
  const save = () => {
    saveState(stateFile, { refresh: [...refreshTokens], granted: [...granted] } satisfies Saved)
  }
  const idToken = () =>
    [
      Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
      Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url"),
      "",
    ].join(".")

  /**
   * The address Google sends the browser back to from its consent screen.
   * `scopes`: exactly what the shop allows (a test's say), or what it left
   * ticked on the page (`fromBrowser`); else what was asked. Either way
   * from the page or by default, what was allowed before comes with it
   * when the request includes it.
   */
  function consent(
    authorizationUrl: string,
    answer: "allow" | "deny" = "allow",
    scopes?: string[],
    fromBrowser = false
  ): string {
    const params = new URL(authorizationUrl).searchParams
    const redirect = new URL(params.get("redirect_uri") ?? "")
    redirect.searchParams.set("state", params.get("state") ?? "")
    const asked = (params.get("scope") ?? "").split(" ").filter(Boolean)
    const valid =
      params.get("client_id") === client.clientId &&
      params.get("response_type") === "code" &&
      params.get("code_challenge_method") === "S256" &&
      params.get("access_type") === "offline" &&
      asked.includes(CONTENT)
    if (answer === "deny" || !valid) {
      redirect.searchParams.set("error", valid ? "access_denied" : "invalid_request")
      return redirect.toString()
    }
    const keep =
      params.get("include_granted_scopes") === "true" && (scopes === undefined || fromBrowser)
    const allowed = [...new Set([...(scopes ?? asked), ...(keep ? granted : [])])]
    for (const scope of allowed) {
      granted.add(scope)
    }
    save()
    const code = `4/${randomId(24)}`
    codes.set(code, {
      challenge: params.get("code_challenge") ?? "",
      redirectUri: params.get("redirect_uri") ?? "",
      scope: allowed.join(" "),
    })
    redirect.searchParams.set("code", code)
    return redirect.toString()
  }

  /** `POST /token`: a code or a refresh token traded, as Google answers it. */
  function token(form: URLSearchParams): { status: number; body: unknown } {
    if (
      form.get("client_id") !== client.clientId ||
      form.get("client_secret") !== client.clientSecret
    ) {
      return { status: 401, body: { error: "invalid_client" } }
    }
    if (form.get("grant_type") === "authorization_code") {
      const code = codes.get(form.get("code") ?? "")
      codes.delete(form.get("code") ?? "")
      const challenge = createHash("sha256")
        .update(form.get("code_verifier") ?? "")
        .digest("base64url")
      if (code?.challenge !== challenge || code.redirectUri !== form.get("redirect_uri")) {
        return { status: 400, body: { error: "invalid_grant" } }
      }
      const refresh = `1//${randomId(24)}`
      const access = `ya29.${randomId(24)}`
      refreshTokens.set(refresh, code.scope)
      accessTokens.set(access, code.scope)
      save()
      return {
        status: 200,
        body: {
          access_token: access,
          expires_in: 3599,
          refresh_token: refresh,
          scope: code.scope,
          token_type: "Bearer",
          id_token: idToken(),
        },
      }
    }
    const scope = refreshTokens.get(form.get("refresh_token") ?? "")
    if (form.get("grant_type") === "refresh_token" && scope !== undefined) {
      const access = `ya29.${randomId(24)}`
      accessTokens.set(access, scope)
      return { status: 200, body: { access_token: access, expires_in: 3599, token_type: "Bearer" } }
    }
    return { status: 400, body: { error: "invalid_grant" } }
  }

  /** `POST /revoke`: the token and every grant of the client end. */
  function revoke(value: string): void {
    refreshTokens.delete(value)
    granted.clear()
    revoked.push(value)
    save()
  }

  return {
    consent,
    token,
    revoke,
    revoked,
    /** The scopes an access token carries; undefined for one Google never gave. */
    scopeOf: (bearer: string): string | undefined => accessTokens.get(bearer),
  }
}

export type OauthFlow = ReturnType<typeof oauthFlow>
