import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { clearSession } from "@/features/assistant/storage"
import { responseFailure } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import type { StaffGate } from "./gated-post"
import { signInWithProof } from "./proof-login"

export const CURRENT_USER_KEY = ["auth", "me"] as const
export const USER_STALE_MS = 5 * 60_000

const USER_FIELDS = "id,email,first_name,last_name"

/** What a user read must hold to count as one; anything else is "could not load", never a user. */
const UserAnswer = z.object({ user: z.object({ id: z.string().min(1) }) })

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
      const body: unknown = await response.json().catch(() => null)
      if (!UserAnswer.safeParse(body).success) {
        throw new Error("auth.me_unreadable")
      }
      return (body as { user: CurrentUser }).user
    },
    staleTime: USER_STALE_MS,
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
 * Email and password → session cookie, as js-sdk's session mode does it
 * (`/auth/session`), through `signInWithProof`: Turnstile's token with
 * every try (adr/0044 Ek 2026-11-24) and the proof of work asked past five
 * tries on the address (428) go along. With 2FA on, the session waits for
 * the code: the challenge comes back for `useVerifyChallenge`.
 */
export function useLogin(gate: StaffGate | null = null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: Credentials): Promise<MfaChallenge | null> =>
      signInWithProof({ email, password }, gate),
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
      // The assistant's conversation leaves with the session (adr/0079 §6)
      clearSession()
      onDone()
    },
  })
}
