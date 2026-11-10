import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { ME_KEY } from "@/features/auth/api"
import type { Me } from "@/features/auth/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/** One of the member's own open panel sessions: a handle, never the session's id. */
export interface Session {
  id: string
  expires_at: string
  current: boolean
}

export const SESSIONS_KEY = ["account", "sessions"] as const

export const sessionsQuery = () =>
  queryOptions({
    queryKey: SESSIONS_KEY,
    queryFn: async () => (await api<{ sessions: Session[] }>("/admin/cp/me/sessions")).sessions,
  })

/** One's own name (`POST /admin/cp/me`). */
export function useSaveProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { first_name: string; last_name: string }) =>
      (await api<{ me: Me }>("/admin/cp/me", { method: "POST", body: input })).me,
    onSuccess: (me) => {
      client.setQueryData(ME_KEY, me)
    },
  })
}

/** New recovery codes, the old ones void; shown once. Asks the step-up. */
export function useNewRecoveryCodes() {
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      withStepUp(
        async (headers) =>
          (
            await api<{ recovery_codes: string[] }>("/admin/cp/me/mfa/recovery-codes", {
              method: "POST",
              body: {},
              headers,
            })
          ).recovery_codes
      ),
  })
}

/**
 * One's own 2FA off, to set it up again on a new phone (step-up). Every
 * other session ends; this one reaches nothing but the setup until then.
 */
export function useTurnOffMfa() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withStepUp((headers) => api<unknown>("/admin/cp/me/mfa", { method: "DELETE", headers })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

/** One session ended by its handle (step-up). */
export function useEndSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      withStepUp((headers) =>
        api<{ ended: boolean }>(`/admin/cp/me/sessions/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers,
        })
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

/** Every session but this one, and every token (step-up, or a sign-in in the last minutes). */
export function useEndOtherSessions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withStepUp((headers) =>
        api<{ ended: number }>("/admin/cp/me/sessions/revoke-others", {
          method: "POST",
          body: {},
          headers,
        })
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}
