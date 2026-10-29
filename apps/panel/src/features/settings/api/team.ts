import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { StaffRole } from "@/features/auth/api/staff"
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

export const useChangeRole = () =>
  useTeamMutation(({ id, role }: { id: string; role: StaffRole }) =>
    sdk.client.fetch(`/admin/staff/members/${encodeURIComponent(id)}`, {
      method: "POST",
      body: { role },
    })
  )

export const useRemoveMember = () =>
  useTeamMutation((id: string) =>
    sdk.client.fetch(`/admin/staff/members/${encodeURIComponent(id)}`, { method: "DELETE" })
  )

export const useInvite = () =>
  useTeamMutation((body: { email: string; role: InvitableRole }) =>
    sdk.client.fetch<MadeInvite>("/admin/staff/invites", { method: "POST", body })
  )

export const useResendInvite = () =>
  useTeamMutation((id: string) =>
    sdk.client.fetch<MadeInvite>(`/admin/staff/invites/${encodeURIComponent(id)}/resend`, {
      method: "POST",
      body: {},
    })
  )

export const useWithdrawInvite = () =>
  useTeamMutation((id: string) =>
    sdk.client.fetch(`/admin/staff/invites/${encodeURIComponent(id)}`, { method: "DELETE" })
  )
