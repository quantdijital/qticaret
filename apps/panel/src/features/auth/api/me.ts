import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const CURRENT_USER_KEY = ["auth", "me"] as const

/** The signed-in admin user; rejects with a 401 when there is none. */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () =>
      (await sdk.admin.user.me({ fields: "id,email,first_name,last_name" })).user,
    staleTime: 5 * 60_000,
  })

/** The user as the SDK types it; no direct dependency on @medusajs/types (one copy for the backend). */
export type CurrentUser = Awaited<ReturnType<typeof sdk.admin.user.me>>["user"]

export function useCurrentUser(): CurrentUser | undefined {
  return useQuery(currentUserQuery()).data
}

export interface Credentials {
  email: string
  password: string
}

/** Email and password → session cookie (js-sdk session mode calls /auth/session). */
export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: Credentials) => {
      await sdk.auth.login("user", "emailpass", { email, password })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    },
  })
}

export function useLogout(onDone: () => void) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => sdk.auth.logout(),
    onSettled: () => {
      client.clear()
      onDone()
    },
  })
}
