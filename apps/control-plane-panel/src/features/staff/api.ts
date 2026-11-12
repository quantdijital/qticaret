import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { StaffRole } from "@/features/auth/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

// Every role, an owner's too (adr/0061 §3.5, 2026-11-12), as the member dialog orders them
export const INVITABLE_ROLES = ["owner", "operator", "finance", "readonly"] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]
export const STAFF_ROLES = ["owner", "operator", "finance", "readonly"] as const

export interface StaffMember {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  role: StaffRole | null
  active: boolean
  mfa: boolean
  /** The signed-in owner themselves. */
  you: boolean
}

export interface StaffInvite {
  id: string
  email: string
  role: StaffRole | null
  expires_at: string
  expired: boolean
  created_at: string
}

/** A link the API made once (an invitation, an enrolment after a reset), never stored. */
export interface SentLink {
  link: string
  /** Sent by e-mail; when not, the owner passes it on by hand. */
  mailed: boolean
}

export const STAFF_KEY = ["staff"] as const

/** `GET /admin/cp/staff` (owner): the staff and the open invitations; a recorded read. */
export const staffQuery = () =>
  queryOptions({
    queryKey: STAFF_KEY,
    queryFn: () => api<{ staff: StaffMember[]; invites: StaffInvite[] }>("/admin/cp/staff"),
  })

function useStaffChange<I, O>(call: (input: I, headers: Record<string, string>) => Promise<O>) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: (input: I) => withStepUp((headers) => call(input, headers)),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: STAFF_KEY })
    },
  })
}

const member = (id: string, action = "") =>
  `/admin/cp/staff/members/${encodeURIComponent(id)}${action}`

/** An invitation with its role (step-up): its link comes back once. */
export const useInvite = () =>
  useStaffChange((input: { email: string; role: InvitableRole }, headers) =>
    api<SentLink>("/admin/cp/staff/invites", { method: "POST", body: input, headers })
  )

export const useChangeRole = () =>
  useStaffChange((input: { id: string; role: StaffRole }, headers) =>
    api<unknown>(member(input.id), { method: "POST", body: { role: input.role }, headers })
  )

export const useDeactivate = () =>
  useStaffChange((id: string, headers) =>
    api<unknown>(member(id, "/deactivate"), { method: "POST", body: {}, headers })
  )

export const useReactivate = () =>
  useStaffChange((id: string, headers) =>
    api<unknown>(member(id, "/reactivate"), { method: "POST", body: {}, headers })
  )

/** A member's 2FA reset (step-up): their single-use enrolment link comes back once. */
export const useResetMfa = () =>
  useStaffChange((id: string, headers) =>
    api<SentLink>(member(id, "/reset-mfa"), { method: "POST", body: {}, headers })
  )

/** An invitation withdrawn: only takes access away, no step-up. */
export function useWithdrawInvite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<unknown>(`/admin/cp/staff/invites/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: STAFF_KEY })
    },
  })
}
