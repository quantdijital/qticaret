import { createPublicKey, sign, verify } from "node:crypto"
import type { JsonWebKey } from "node:crypto"

/**
 * Sign in with Apple, the parts that are JWTs (adr/0037 §3), checked
 * against Apple's REST API documentation: the ES256 client secret the
 * token endpoint asks for, and the RS256 identity token it answers with.
 * Node's crypto does both; no JWT library is needed.
 */

export const APPLE_ISSUER = "https://appleid.apple.com"

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url")

const decode = (part: string | undefined): Record<string, unknown> | null => {
  if (!part) {
    return null
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"))
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export interface AppleClientSecretInput {
  teamId: string
  keyId: string
  /** The Services ID: the `client_id` of every request. */
  clientId: string
  /** The .p8 key from Apple, in PEM. */
  privateKey: string
  now?: Date
}

/** A client secret good for five minutes: made fresh for each token request. */
export function appleClientSecret(input: AppleClientSecretInput): string {
  const iat = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const signing = `${encode({ alg: "ES256", kid: input.keyId })}.${encode({
    iss: input.teamId,
    iat,
    exp: iat + 300,
    aud: APPLE_ISSUER,
    sub: input.clientId,
  })}`
  const signature = sign("sha256", Buffer.from(signing), {
    key: input.privateKey,
    // JWS wants r and s side by side, not DER
    dsaEncoding: "ieee-p1363",
  })
  return `${signing}.${signature.toString("base64url")}`
}

/** Apple's public keys, as its `/auth/keys` lists them. */
export type AppleKey = JsonWebKey & { kid?: string }

export interface AppleIdentity {
  /** Apple's stable id for the person, per team. */
  sub: string
  email: string | null
  /** Apple says so for every address it hands out, relay addresses included. */
  emailVerified: boolean
  isPrivateEmail: boolean
}

/** The key id an identity token names, to find its key (or refetch the list). */
export const keyIdOf = (idToken: string): string | null => {
  const kid = decode(idToken.split(".")[0])?.["kid"]
  return typeof kid === "string" ? kid : null
}

const truthy = (value: unknown): boolean => value === true || value === "true"

/**
 * The identity in a token Apple signed for this client and this sign-in
 * (its nonce), not yet expired; null for anything else.
 */
export function verifyAppleIdToken(
  idToken: string,
  keys: readonly AppleKey[],
  expected: { clientId: string; nonce: string; now?: Date }
): AppleIdentity | null {
  const [head, body, signature] = idToken.split(".")
  const header = decode(head)
  const claims = decode(body)
  const jwk = keys.find((key) => key.kid === header?.["kid"])
  if (!header || !claims || !signature || header["alg"] !== "RS256" || !jwk) {
    return null
  }
  const signed = verify(
    "RSA-SHA256",
    Buffer.from(`${head ?? ""}.${body ?? ""}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signature, "base64url")
  )
  const now = Math.floor((expected.now ?? new Date()).getTime() / 1000)
  const sub = claims["sub"]
  const email = claims["email"]
  if (
    !signed ||
    claims["iss"] !== APPLE_ISSUER ||
    claims["aud"] !== expected.clientId ||
    typeof claims["exp"] !== "number" ||
    claims["exp"] <= now ||
    claims["nonce"] !== expected.nonce ||
    typeof sub !== "string" ||
    sub === ""
  ) {
    return null
  }
  return {
    sub,
    email: typeof email === "string" ? email.trim().toLowerCase() : null,
    emailVerified: truthy(claims["email_verified"]),
    isPrivateEmail: truthy(claims["is_private_email"]),
  }
}

/**
 * The name Apple sends once, the first time, as a JSON string the browser
 * passed on: never trusted beyond two short plain strings.
 */
export function appleNameOf(user: unknown): { firstName: string | null; lastName: string | null } {
  let parsed: unknown = user
  if (typeof user === "string") {
    try {
      parsed = JSON.parse(user)
    } catch {
      parsed = null
    }
  }
  const name = (parsed as { name?: Record<string, unknown> } | null)?.name
  const clean = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null
    }
    const text = value
      .replace(/[\p{Cc}<>]/gu, "")
      .trim()
      .slice(0, 50)
    return text === "" ? null : text
  }
  return { firstName: clean(name?.["firstName"]), lastName: clean(name?.["lastName"]) }
}
