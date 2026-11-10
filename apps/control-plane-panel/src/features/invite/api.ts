import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { openSession } from "@/features/auth/api"
import type { StaffRole } from "@/features/auth/api"
import { api } from "@/lib/api"

export const INVITE_HEADER = "x-cp-invite"

/** What an invitation is for (`POST /admin/cp/invites/info`): a POST, the token in the body. */
export const inviteInfoQuery = (token: string) =>
  queryOptions({
    queryKey: ["invite", "info", token],
    queryFn: () =>
      api<{ email: string; role: StaffRole }>("/admin/cp/invites/info", {
        method: "POST",
        body: { token },
      }),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  })

export interface Acceptance {
  token: string
  email: string
  first_name: string
  last_name: string
  password: string
}

/**
 * An invitation accepted (adr/0061 Ek C4, L1): a login for the invited
 * address (registration only with the invitation, `x-cp-invite`), the
 * member made with that login's token, then a sign-in with the new
 * password, which opens the session. 2FA is set up next, before anything
 * else; the role is granted once it is.
 */
export async function acceptInvite(input: Acceptance): Promise<void> {
  const registered = await api<{ token: string }>("/auth/user/emailpass/register", {
    method: "POST",
    body: { email: input.email, password: input.password },
    headers: { [INVITE_HEADER]: input.token },
  })
  await api<unknown>("/admin/cp/invites/accept", {
    method: "POST",
    body: { token: input.token, first_name: input.first_name, last_name: input.last_name },
    bearer: registered.token,
  })
  const signedIn = await api<{ token: string }>("/auth/user/emailpass", {
    method: "POST",
    body: { email: input.email, password: input.password },
  })
  await openSession(signedIn.token)
}

export function useAcceptInvite() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: acceptInvite,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] })
    },
  })
}
