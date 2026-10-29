import { queryOptions } from "@tanstack/react-query"

/** What an invitation is for: the address it was sent to and the role it gives. */
export interface InviteInfo {
  email: string
  role: "admin" | "operations" | "readonly"
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
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null
  if (!response.ok) {
    const key = typeof body?.message === "string" ? body.message : null
    throw new InviteFailure(response.status, key)
  }
  return body as T
}

export const inviteInfoQuery = (token: string) =>
  queryOptions({
    queryKey: ["invite", token],
    queryFn: () =>
      call<InviteInfo>(`/admin/staff/invites/info?${new URLSearchParams({ token }).toString()}`),
    retry: false,
    staleTime: Infinity,
  })

/**
 * The invitation accepted: a login for the invited address (or the one an
 * earlier try made), then the member made with it. Signing in follows.
 */
export async function acceptInvite(input: {
  token: string
  email: string
  password: string
  first_name: string
  last_name: string
}): Promise<void> {
  const credentials = JSON.stringify({ email: input.email, password: input.password })
  const login = await call<{ token: string }>("/auth/user/emailpass/register", {
    method: "POST",
    body: credentials,
  }).catch(() =>
    call<{ token: string }>("/auth/user/emailpass", { method: "POST", body: credentials })
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
