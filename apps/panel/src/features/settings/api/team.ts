import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { StaffRole } from "@/features/auth/api/staff"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

export type InvitableRole = Exclude<StaffRole, "owner">

export const STAFF_ROLES: readonly StaffRole[] = ["owner", "admin", "operations", "readonly"]
export const INVITABLE_ROLES: readonly InvitableRole[] = ["admin", "operations", "readonly"]

export interface TeamMember {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  /** Null: the user reaches nothing until the owner gives a role. */
  role: StaffRole | null
  you: boolean
  /** Whether their 2FA is on. */
  mfa: boolean
}

export interface TeamInvite {
  id: string
  email: string
  role: InvitableRole
  expires_at: string
  expired: boolean
  created_at: string
}

/** `GET /admin/staff` (F12.6): the people and, for the owner, the open invitations. */
export interface Team {
  staff: TeamMember[]
  invites: TeamInvite[] | null
}

export interface MadeInvite {
  invite: TeamInvite
  /** The invitation's link, in this answer only, for the owner to pass on by hand. */
  link: string
}

const KEY = ["team"] as const

export const teamQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<Team>("/admin/staff"),
    staleTime: 30_000,
  })

function useTeamMutation<Input, Output>(call: (input: Input) => Promise<Output>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

// An owner made or unmade, a member's 2FA reset: the owner proves themselves again
export const useChangeRole = () =>
  useTeamMutation(({ id, role }: { id: string; role: StaffRole }) =>
    withReauth((extra) =>
      sdk.client.fetch(`/admin/staff/members/${encodeURIComponent(id)}`, {
        method: "POST",
        body: { role },
        ...extra,
      })
    )
  )

export const useRemoveMember = () =>
  useTeamMutation((id: string) =>
    withReauth((extra) =>
      sdk.client.fetch(`/admin/staff/members/${encodeURIComponent(id)}`, {
        method: "DELETE",
        ...extra,
      })
    )
  )

/** Someone new on the team: asked to prove oneself again (adr/0040 §3). */
export const useInvite = () =>
  useTeamMutation((body: { email: string; role: InvitableRole }) =>
    withReauth((extra) =>
      sdk.client.fetch<MadeInvite>("/admin/staff/invites", { method: "POST", body, ...extra })
    )
  )

export const useResendInvite = () =>
  useTeamMutation((id: string) =>
    withReauth((extra) =>
      sdk.client.fetch<MadeInvite>(`/admin/staff/invites/${encodeURIComponent(id)}/resend`, {
        method: "POST",
        body: {},
        ...extra,
      })
    )
  )

export const useWithdrawInvite = () =>
  useTeamMutation((id: string) =>
    sdk.client.fetch(`/admin/staff/invites/${encodeURIComponent(id)}`, { method: "DELETE" })
  )

/** A member's 2FA turned off by the owner: their phone lost (they set it up again). */
export const useResetMemberMfa = () =>
  useTeamMutation((id: string) =>
    withReauth((extra) =>
      sdk.client.fetch(`/admin/staff/members/${encodeURIComponent(id)}/reset-mfa`, {
        method: "POST",
        body: {},
        ...extra,
      })
    )
  )
