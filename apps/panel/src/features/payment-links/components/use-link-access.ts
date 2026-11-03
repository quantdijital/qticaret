import { useQuery } from "@tanstack/react-query"
import { staffQuery } from "@/features/auth/api/staff"
import { PAYMENT_LINKS_FLAG } from "@/features/payment-links/api/types"
import { featuresQuery } from "@/features/settings/api/features"

export type LinkAccess = "loading" | "off" | "denied" | "ok"

/**
 * Whether the screens open (adr/0051 §8): the shop has payment links on
 * and the person may make them (owner, admin, operations: `paymentLinks`).
 * `canManage`: the discount, cancelling and extending (owner and admin).
 */
export function useLinkAccess(): { access: LinkAccess; canTurnOn: boolean; canManage: boolean } {
  const features = useQuery(featuresQuery())
  const staff = useQuery(staffQuery())
  const can = staff.data?.can
  const canTurnOn = can?.settings ?? false
  const canManage = can?.paymentLinksManage ?? false
  if (features.isPending || staff.isPending) {
    return { access: "loading", canTurnOn, canManage }
  }
  if (!features.data?.some((flag) => flag.key === PAYMENT_LINKS_FLAG && flag.enabled)) {
    return { access: "off", canTurnOn, canManage }
  }
  return { access: can?.paymentLinks ? "ok" : "denied", canTurnOn, canManage }
}

export type LinkGateState = ReturnType<typeof useLinkAccess>
