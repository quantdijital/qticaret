import { queryOptions, useQuery } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
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
  /** Turning the storefront dark (adr/0053): the owner's alone. */
  | "maintenance"
  | "team"
  | "staff"
  | "audit"
  | "taxId"
  /** A traveler's full ID or passport number (adr/0076 §7): owner and admin, proved again. */
  | "travelerDocuments"
  /** A traveler's own KVKK request: their rows found, copied, deleted (adr/0076 Ek D6b). */
  | "travelerRequests"
  | "privacy"
  | "invoices"
  | "migration"
  | "fraud"
  /** Writing and sending bulk e-mail and SMS (adr/0050): owner and admin. */
  | "bulkMessages"
  /** Making and sending a payment link, without a discount (adr/0051): owner, admin, operations. */
  | "paymentLinks"
  /** A payment link's discount, cancelling and extending it (adr/0051 §8): owner and admin. */
  | "paymentLinksManage"
  /** Writing, previewing, publishing and restarting the legal texts' drafts (F13.1): owner and admin. */
  | "legalTexts"
  /** Adding, renaming, removing the KDV rates and moving the default (adr/0007 Ek 2026-11-04): the owner's alone. */
  | "vatRates"
  /** Adding, changing and deleting site search's synonym groups (adr/0056): owner and admin. */
  | "searchSynonyms"
  /** The order list as an Excel or CSV file, every customer's details in it: the owner's alone. */
  | "orderExport"
  /** Editing customers, adding a guest, their addresses and note (2026-11-06): owner, admin, operations. */
  | "customers"
  /** The carts left behind and their reminders (2026-11-06): owner, admin, operations. */
  | "abandonedCarts"
  /** An order's message sent again (2026-11-06): owner, admin, operations. */
  | "resendMessages"
  /** The wholesalers, their levels and prices (ADR-0068 §9): owner and admin. */
  | "wholesale"

export interface StaffMe {
  user_id: string
  /** Null: removed from the staff, or never given a role; they reach nothing. */
  role: StaffRole | null
  can: Record<Capability, boolean>
  /** 2FA: whether this environment can ask it, the shop requires it, it is set up, this session passed it. */
  mfa: { available: boolean; required: boolean; enabled: boolean; passed: boolean }
  /**
   * The shop's status for every role (adr/0061 Ek C15): `restricted` or
   * `suspended` close most writes. Absent from an older backend: active.
   */
  plan?: { status: PlanStatus }
}

/** What the shop's status lets the panel do (adr/0061 §5.5). */
export type PlanStatus = "active" | "restricted" | "suspended"

export const STAFF_KEY = ["auth", "staff"] as const

/** `GET /admin/staff/me`: the signed-in staff member's role and what it allows. */
export const STAFF_STALE_MS = 60_000

export const staffQuery = () =>
  queryOptions({
    queryKey: STAFF_KEY,
    queryFn: () => sdk.client.fetch<StaffMe>("/admin/staff/me"),
    staleTime: STAFF_STALE_MS,
  })

export function useStaff(): StaffMe | undefined {
  return useQuery(staffQuery()).data
}

/** Whether the signed-in staff member may: false until known, so nothing is offered on a guess. */
export function useCan(capability: Capability): boolean {
  // An answer without `can` (an older backend, a stand-in) offers nothing rather than failing
  const can = useStaff()?.can as Partial<Record<Capability, boolean>> | undefined
  return can?.[capability] ?? false
}

/** The capability check, for lists of things to offer. */
export function useCapabilities(): (capability: Capability) => boolean {
  const can = useStaff()?.can
  return (capability) => can?.[capability] ?? false
}

const PLAN_STATUSES: readonly string[] = ["active", "restricted", "suspended"]

/** The shop's status as `staff/me` gives it; active while unknown or of another shape. */
export function usePlanStatus(): PlanStatus {
  const status = (useStaff()?.plan as { status?: unknown } | undefined)?.status
  return typeof status === "string" && PLAN_STATUSES.includes(status)
    ? (status as PlanStatus)
    : "active"
}

/** Whether the shop's status closes writes beyond its allow-list (adr/0061 Ek C15). */
export const usePlanRestricted = (): boolean => usePlanStatus() !== "active"

/**
 * After any refused write (403): the role or the shop's status may have
 * changed since `staff/me` was read, so it is read again and the strip
 * above every page and the offered buttons catch up (adr/0061 Ek C15).
 */
export function refreshStandingAfter(client: QueryClient, failure: unknown): void {
  if ((failure as { status?: unknown } | null)?.status === 403) {
    void client.invalidateQueries({ queryKey: STAFF_KEY })
  }
}
