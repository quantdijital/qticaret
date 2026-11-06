import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { StaffRole } from "@/features/auth/api/staff"
import { responseFailure } from "@/lib/errors"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** `GET /admin/staff/me/profile` (the owner, 2026-11-06): the signed-in member's own account. */
export interface MyProfile {
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    /** "Unvan": free text, kept in the user's metadata. */
    job_title: string | null
    role: StaffRole | null
    created_at: string
  }
  /** Their own address change waiting for its link: the new address, until when it holds. */
  pending_email: { to: string; expires_at: string } | null
}

export interface ProfileInput {
  first_name: string
  last_name: string
  job_title: string | null
}

const KEY = ["auth", "profile"] as const

export const myProfileQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<MyProfile>("/admin/staff/me/profile"),
    staleTime: 30_000,
  })

/**
 * `GET /admin/staff/me/sessions`: panel sessions open on the account, this
 * one counted; null when the server cannot tell. Asked apart, when shown.
 */
export const mySessionsQuery = () =>
  queryOptions({
    queryKey: ["auth", "sessions"] as const,
    queryFn: () => sdk.client.fetch<{ open: number | null }>("/admin/staff/me/sessions"),
    staleTime: 60_000,
  })

// The topbar's name and address come from the same account: every "auth" read again
function useAccountMutation<Input, Output>(call: (input: Input) => Promise<Output>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: () => client.invalidateQueries({ queryKey: ["auth"] }),
  })
}

export const useUpdateProfile = () =>
  useAccountMutation((body: ProfileInput) =>
    sdk.client.fetch<MyProfile>("/admin/staff/me/profile", { method: "POST", body })
  )

/** The password, with the current one; with 2FA on, its code is asked too (adr/0040 §3). */
export const useChangePassword = () =>
  useAccountMutation((body: { current_password: string; new_password: string }) =>
    withReauth((extra) =>
      sdk.client.fetch<{ changed: boolean; sessions_ended: number }>("/admin/staff/me/password", {
        method: "POST",
        body,
        ...extra,
      })
    )
  )

/** A new sign-in address: nothing changes until the link sent there is opened. */
export const useRequestEmailChange = () =>
  useAccountMutation((body: { email: string; current_password: string }) =>
    withReauth((extra) =>
      sdk.client.fetch<{ sent: boolean; expires_at: string }>("/admin/staff/me/email", {
        method: "POST",
        body,
        ...extra,
      })
    )
  )

/** Signing out everywhere but here: the proof is asked. */
export const useEndOtherSessions = () =>
  useAccountMutation(() =>
    withReauth((extra) =>
      sdk.client.fetch<{ ended: number }>("/admin/staff/me/sessions/end-others", {
        method: "POST",
        body: {},
        ...extra,
      })
    )
  )

/** The waiting address change dropped: its link opens nothing. */
export const useCancelEmailChange = () =>
  useAccountMutation(() =>
    sdk.client.fetch<{ canceled: boolean }>("/admin/staff/me/email/cancel", {
      method: "POST",
      body: {},
    })
  )

/**
 * The link from the new address's e-mail, confirmed by its member signed
 * in (security review 2026-11-06). A plain request, so the failure's key
 * stays in `code` for the page's own words.
 */
export async function confirmEmailChange(token: string): Promise<void> {
  const response = await fetch("/admin/staff/me/email/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  })
  if (!response.ok) {
    throw await responseFailure(response)
  }
}
