import { queryOptions, useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export type StaffRole = "owner" | "admin" | "operations" | "readonly"

/** What the panel may offer (the API decides again on every request; adr/0040). */
export type Capability =
  | "settings"
  | "catalog"
  | "marketing"
  | "orders"
  | "money"
  | "stock"
  | "moderation"
  | "accounts"
  | "keys"
  | "security"
  | "team"
  | "staff"
  | "audit"
  | "taxId"
  | "privacy"
  | "invoices"

export interface StaffMe {
  user_id: string
  /** Null: removed from the staff, or never given a role; they reach nothing. */
  role: StaffRole | null
  can: Record<Capability, boolean>
  /** 2FA: whether this environment can ask it, the shop requires it, it is set up, this session passed it. */
  mfa: { available: boolean; required: boolean; enabled: boolean; passed: boolean }
}

export const STAFF_KEY = ["auth", "staff"] as const

/** `GET /admin/staff/me`: the signed-in staff member's role and what it allows. */
export const staffQuery = () =>
  queryOptions({
    queryKey: STAFF_KEY,
    queryFn: () => sdk.client.fetch<StaffMe>("/admin/staff/me"),
    staleTime: 60_000,
  })

export function useStaff(): StaffMe | undefined {
  return useQuery(staffQuery()).data
}

/** Whether the signed-in staff member may: false until known, so nothing is offered on a guess. */
export function useCan(capability: Capability): boolean {
  return useStaff()?.can[capability] ?? false
}

/** The capability check, for lists of things to offer. */
export function useCapabilities(): (capability: Capability) => boolean {
  const can = useStaff()?.can
  return (capability) => can?.[capability] ?? false
}
