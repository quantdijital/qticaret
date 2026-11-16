import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { responseFailure } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { signInWithProof } from "./proof-login"

export const CURRENT_USER_KEY = ["auth", "me"] as const

const USER_FIELDS = "id,email,first_name,last_name"

/** Tried once more only when the answer never came or the server failed; 401, 403 and 429 are answers. */
const retryTransient = (failures: number, error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status
  return failures < 1 && (typeof status !== "number" || status >= 500)
}

/**
 * The signed-in admin user; rejects with a 401 when there is none. A plain
 * request (the session cookie, like the SDK's), so a 429's `Retry-After`
 * reaches the guard (`loadCurrentUser`).
 */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: CURRENT_USER_KEY,
    queryFn: async (): Promise<CurrentUser> => {
      const response = await fetch(`/admin/users/me?fields=${encodeURIComponent(USER_FIELDS)}`, {
        credentials: "include",
        headers: { accept: "application/json" },
      })
      if (!response.ok) {
        throw await responseFailure(response)
      }
      return ((await response.json()) as { user: CurrentUser }).user
    },
    staleTime: 5 * 60_000,
    retry: retryTransient,
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

/** The second step a sign-in asks for when 2FA is on (adr/0040 §2). */
export interface MfaChallenge {
  id: string
  methods: string[]
}

/**
 * Email and password → session cookie (js-sdk session mode calls
 * /auth/session). With 2FA on, the session waits for the code: the
 * challenge comes back for `useVerifyChallenge`. Past five tries on the
 * address the backend asks a proof of work first (428): solved here.
 */
export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: Credentials): Promise<MfaChallenge | null> => {
      try {
        const result = await sdk.auth.login("user", "emailpass", { email, password })
        return typeof result === "object" && "mfa_required" in result ? result.mfa_challenge : null
      } catch (error) {
        if ((error as { status?: unknown } | null)?.status !== 428) {
          throw error
        }
        return signInWithProof({ email, password })
      }
    },
    onSuccess: async () => {
      // Who signed in, and their role
      await client.invalidateQueries({ queryKey: ["auth"] })
    },
  })
}

/** The sign-in's code: an authenticator's six digits or one recovery code; the session is then whole. */
export function useVerifyChallenge() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      method: "totp" | "recovery_code"
      code: string
    }): Promise<void> => {
      await sdk.auth.mfa.verifyChallenge(input.id, { method: input.method, code: input.code })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] })
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
