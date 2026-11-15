import { useQuery } from "@tanstack/react-query"
import { staffQuery } from "@/features/auth/api/staff"
import type { Capability } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import { WHOLESALE_FLAG } from "./types"

export type WholesaleAccess = "loading" | "off" | "denied" | "ok"

/**
 * Whether the wholesale screens open (ADR-0068 §9): the shop has
 * `customers.wholesale` on and the person is owner or admin
 * (`wholesale`). The API decides again on every request: off, its routes
 * are missing; another role, they refuse.
 */
export function useWholesaleAccess(): { access: WholesaleAccess; canTurnOn: boolean } {
  const features = useQuery(featuresQuery())
  const staff = useQuery(staffQuery())
  // An answer without `can` (an older backend, a stand-in) offers nothing rather than failing
  const can = staff.data?.can as Partial<Record<Capability, boolean>> | undefined
  const canTurnOn = can?.settings ?? false
  if (features.isPending || staff.isPending) {
    return { access: "loading", canTurnOn }
  }
  if (!can?.wholesale) {
    return { access: "denied", canTurnOn }
  }
  if (
    !Array.isArray(features.data) ||
    !features.data.some((flag) => flag.key === WHOLESALE_FLAG && flag.enabled)
  ) {
    return { access: "off", canTurnOn }
  }
  return { access: "ok", canTurnOn }
}

/** Whether to offer anything wholesale here: false until both are known. */
export const useWholesaleOpen = (): boolean => useWholesaleAccess().access === "ok"
