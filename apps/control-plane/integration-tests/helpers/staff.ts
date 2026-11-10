import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { CP_STAFF_MODULE } from "../../src/modules/cp-staff"
import type CpStaffModuleService from "../../src/modules/cp-staff/service"
import type { CpStaffRole } from "../../src/lib/staff/roles"
import { freshCode } from "./totp"

export interface Answer<T = Record<string, unknown>> {
  status: number
  data: T
  headers: Record<string, string | string[] | undefined>
}

// test-utils types `api` as any (axios); answers of any status are read, not thrown
export interface HttpClient {
  get<T = Record<string, unknown>>(url: string, config?: object): Promise<Answer<T>>
  post<T = Record<string, unknown>>(url: string, body: unknown, config?: object): Promise<Answer<T>>
  delete<T = Record<string, unknown>>(url: string, config?: object): Promise<Answer<T>>
}

export const anyStatus = { validateStatus: () => true }

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

export const tokenOf = (answer: Answer): string => (answer.data as { token: string }).token

/** The auth identity a token names (its payload, unverified: the test's own token). */
export function identityOf(token: string): string {
  const [, payload = ""] = token.split(".")
  return (
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      auth_identity_id: string
    }
  ).auth_identity_id
}

export interface Member {
  userId: string
  email: string
  password: string
  identity: string
  secret: string
  /** TOTP codes this test gave: each is taken once. */
  used: Set<string>
  recoveryCodes: string[]
  /** A session token that passed 2FA. */
  headers: Record<string, string>
}

/** A login for the address: the registration's token (no user yet). */
export async function registerLogin(http: HttpClient, email: string, password: string) {
  const registration = await http.post("/auth/user/emailpass/register", { email, password })
  return tokenOf(registration)
}

/** Setting 2FA up as the panel does: started, confirmed with the first code and the password. */
export async function enrolTotp(
  http: HttpClient,
  token: string,
  password: string,
  used: Set<string>
) {
  const started = await http.post<{ secret: string }>(
    "/admin/cp/me/mfa",
    {},
    { ...anyStatus, headers: bearer(token) }
  )
  const secret = started.data.secret
  const confirmed = await http.post<{ recovery_codes: string[] }>(
    "/admin/cp/me/mfa/verify",
    { code: freshCode(secret, used), password },
    { ...anyStatus, headers: bearer(token) }
  )
  if (confirmed.status !== 200) {
    throw new Error(`2FA setup failed: ${String(confirmed.status)}`)
  }
  return { secret, recoveryCodes: confirmed.data.recovery_codes }
}

/** A sign-in with the password, then the app's code: a token that passed 2FA. */
export async function signInWithCode(
  http: HttpClient,
  member: Pick<Member, "email" | "password" | "secret" | "used">
): Promise<string> {
  const login = await http.post<{ token: string; mfa_challenge?: { id: string } }>(
    "/auth/user/emailpass",
    { email: member.email, password: member.password },
    anyStatus
  )
  const verified = await http.post<{ token: string }>(
    `/auth/mfa/challenges/${login.data.mfa_challenge?.id ?? ""}/verify`,
    { method: "totp", code: freshCode(member.secret, member.used) },
    { ...anyStatus, headers: bearer(login.data.token) }
  )
  if (verified.status !== 200) {
    throw new Error(`sign-in with code failed: ${String(verified.status)}`)
  }
  return verified.data.token
}

/** A staff member in `role` with 2FA set up and passed, made the short way. */
export async function makeMember(
  http: HttpClient,
  container: MedusaContainer,
  role: CpStaffRole
): Promise<Member> {
  const email = `staff-${randomUUID()}@quant.test`
  // Throwaway credential for this test database only
  const password = randomUUID()
  const identity = identityOf(await registerLogin(http, email, password))
  const { result: user } = await createUserAccountWorkflow(container).run({
    input: { authIdentityId: identity, userData: { email } },
  })
  await container.resolve<CpStaffModuleService>(CP_STAFF_MODULE).setRole(user.id, role, null)
  const first = await http.post("/auth/user/emailpass", { email, password })
  const used = new Set<string>()
  const { secret, recoveryCodes } = await enrolTotp(http, tokenOf(first), password, used)
  const token = await signInWithCode(http, { email, password, secret, used })
  return {
    userId: user.id,
    email,
    password,
    identity,
    secret,
    used,
    recoveryCodes,
    headers: bearer(token),
  }
}

/** A step-up proof for the member, proved with one of their recovery codes (each once). */
export async function stepUp(
  http: HttpClient,
  member: Member,
  headers: Record<string, string> = member.headers
): Promise<Record<string, string>> {
  const code = member.recoveryCodes.shift() ?? ""
  const answer = await http.post<{ step_up: { token: string } }>(
    "/admin/cp/me/step-up",
    { method: "recovery_code", code },
    { ...anyStatus, headers }
  )
  if (answer.status !== 200) {
    throw new Error(`step-up failed: ${String(answer.status)}`)
  }
  return { ...headers, "x-cp-step-up": answer.data.step_up.token }
}
