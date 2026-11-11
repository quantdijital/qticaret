import type { SubscriptionStatus, TenantStatus } from "@qticaret/types/control-plane"

/**
 * Where billing moves a shop (adr/0061 §2, Ek C16), pure: `active` →
 * `restricted` when its subscription is restricted (a charge past its
 * grace), `restricted` → `active` once it is not. Billing never suspends
 * a shop, never opens a suspended one (staff resume it, by its payments)
 * and never touches one being set up or closed. Null: no move.
 */
export function billingTarget(
  tenant: TenantStatus,
  subscription: SubscriptionStatus
): "restricted" | "active" | null {
  if (tenant === "active" && subscription === "restricted") {
    return "restricted"
  }
  if (tenant === "restricted" && subscription !== "restricted") {
    return "active"
  }
  return null
}
