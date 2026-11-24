import { queryOptions } from "@tanstack/react-query"
import { passwordRuleText } from "../password-rule"
import { answerKey, isTurnstileRefusal, postGated } from "./gated-post"
import type { StaffGate } from "./gated-post"

/** What an invitation is for: the address it was sent to and the role it gives. */
export interface InviteInfo {
  email: string
  // `owner` only from a new shop's setup invitation (adr/0061 Ek C10)
  role: "owner" | "admin" | "operations" | "readonly"
}

/** An API failure on this page: no session yet, so the answer carries a key, not a sentence. */
export class InviteFailure extends Error {
  constructor(
    readonly status: number,
    readonly key: string | null
  ) {
    super(key ?? `http_${String(status)}`)
  }
}

// Before an account there is no session: plain requests, the login's token where one is needed
async function call<T>(
  path: string,
  init: { method?: string; body?: string; authorization?: string } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init.authorization ? { authorization: init.authorization } : {}),
    },
    ...(init.body === undefined ? {} : { body: init.body }),
  })
  const body = (await response.json().catch(() => null)) as {
    code?: unknown
    message?: unknown
  } | null
  if (!response.ok) {
    // A sign-in route answers this panel with its sentence, the key kept in `code`
    const key =
      typeof body?.code === "string"
        ? body.code
        : typeof body?.message === "string"
          ? body.message
          : null
    throw new InviteFailure(response.status, key)
  }
  return body as T
}

export const inviteInfoQuery = (token: string) =>
  queryOptions({
    queryKey: ["invite", token],
    // The token in the body: a URL's query lands in access logs
    queryFn: () =>
      call<InviteInfo>("/admin/staff/invites/info", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    retry: false,
    staleTime: Infinity,
  })

/**
 * The invitation accepted: a login for the invited address (or the one an
 * earlier try made), then the member made with it. Signing in follows.
 */
export async function acceptInvite(
  input: {
    token: string
    email: string
    password: string
    first_name: string
    last_name: string
  },
  // Turnstile's tokens (adr/0044 Ek 2026-11-24): the login's creation (`staff_register`) and an
  // earlier try's login, a sign-in (`staff_login`)
  gates: { register: StaffGate | null; login: StaffGate | null } = { register: null, login: null }
): Promise<void> {
  const credentials = { email: input.email, password: input.password }
  const gatedToken = async (path: string, gate: StaffGate | null) => {
    const answer = await postGated<{ token?: string }>(path, credentials, gate)
    if (answer.status >= 400 || !answer.body.token) {
      throw new InviteFailure(answer.status, answerKey(answer.body))
    }
    return { token: answer.body.token }
  }
  const login = await gatedToken("/auth/user/emailpass/register", gates.register).catch(
    (error: unknown) => {
      // A password the rule refuses, or Turnstile's refusal, is the answer; anything else may be an
      // earlier try's login
      if (passwordRuleText(error) || isTurnstileRefusal(error)) {
        throw error
      }
      return gatedToken("/auth/user/emailpass", gates.login)
    }
  )
  await call("/admin/staff/invites/accept", {
    method: "POST",
    authorization: `Bearer ${login.token}`,
    body: JSON.stringify({
      token: input.token,
      first_name: input.first_name,
      last_name: input.last_name,
    }),
  })
}
