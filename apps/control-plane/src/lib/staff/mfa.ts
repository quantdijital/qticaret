import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * A staff member's 2FA (adr/0061 §3.5) through Medusa's auth module: a TOTP
 * factor and its recovery codes. Called from the routes, not a workflow:
 * the factor's secret and the codes must never sit in a workflow's input
 * or output (adr/0061 §4.3). Each change is a single module call, or one
 * undone on failure here.
 */

type Container = Pick<MedusaContainer, "resolve">

const auth = (container: Container) => container.resolve(Modules.AUTH)

async function factorsOf(container: Container, identity: string, status: "enabled" | "pending") {
  return auth(container).listAuthMfa(
    { auth_identity_id: identity, status },
    { select: ["id"], take: 10 }
  )
}

/**
 * A new TOTP factor, pending until its first code: the secret and its
 * otpauth URL, shown once. A setup left half-way goes first; one already
 * on is refused (turning it off asks the step-up).
 */
export async function startTotp(
  container: Container,
  identity: string,
  input: { label: string; issuer: string }
): Promise<{ secret: string; otpauth_url: string }> {
  if ((await factorsOf(container, identity, "enabled")).length > 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.mfa_already_enabled")
  }
  for (const pending of await factorsOf(container, identity, "pending")) {
    await auth(container).disableAuthMfa({ id: pending.id })
  }
  const started = await auth(container).startAuthMfa({
    auth_identity_id: identity,
    provider: "totp",
    label: input.label,
    issuer: input.issuer,
  })
  if (!started.secret || !started.otpauth_url) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.mfa_start_failed")
  }
  return { secret: started.secret, otpauth_url: started.otpauth_url }
}

/**
 * The pending factor confirmed with its first code, then the first recovery
 * codes, shown once. Codes that cannot be made turn the factor off again:
 * nobody is left with 2FA and no way back.
 */
export async function confirmTotp(
  container: Container,
  identity: string,
  code: string
): Promise<{ recovery_codes: string[] } | null> {
  const [pending] = await factorsOf(container, identity, "pending")
  if (!pending) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.mfa_not_started")
  }
  try {
    await auth(container).verifyAuthMfa({ id: pending.id, auth_identity_id: identity, code })
  } catch {
    return null
  }
  try {
    const { codes } = await auth(container).generateAuthMfaRecoveryCodes({
      auth_identity_id: identity,
    })
    return { recovery_codes: codes }
  } catch (error) {
    await auth(container).disableAuthMfa({ id: pending.id })
    throw error
  }
}

/** New recovery codes, the old ones void; shown once. */
export async function renewRecoveryCodes(
  container: Container,
  identity: string
): Promise<string[]> {
  const { codes } = await auth(container).generateAuthMfaRecoveryCodes({
    auth_identity_id: identity,
  })
  return codes
}

/** The login (auth identity) of an address, or null (the shop's `loginsOf`, one address). */
export async function loginOf(container: Container, email: string): Promise<string | null> {
  const [login] = await auth(container).listProviderIdentities(
    { provider: "emailpass", entity_id: email },
    { select: ["auth_identity_id"], take: 1 }
  )
  return login?.auth_identity_id ?? null
}

/** Which of these addresses have 2FA on (lower case): an enabled factor on their login. */
export async function mfaOnFor(
  container: Container,
  emails: readonly string[]
): Promise<Set<string>> {
  const logins = await Promise.all(
    emails.map(async (email) => [email.toLowerCase(), await loginOf(container, email)] as const)
  )
  const factors = await auth(container).listAuthMfa(
    { status: "enabled" },
    { select: ["auth_identity_id"], take: 1000 }
  )
  const on = new Set(factors.map((factor) => factor.auth_identity_id))
  return new Set(
    logins.filter(([, login]) => login !== null && on.has(login)).map(([email]) => email)
  )
}

/** Every factor of the identity off, a half-way one included; how many. */
export async function disableAllFactors(container: Container, identity: string): Promise<number> {
  const factors = [
    ...(await factorsOf(container, identity, "enabled")),
    ...(await factorsOf(container, identity, "pending")),
  ]
  for (const factor of factors) {
    await auth(container).disableAuthMfa({ id: factor.id })
  }
  return factors.length
}
