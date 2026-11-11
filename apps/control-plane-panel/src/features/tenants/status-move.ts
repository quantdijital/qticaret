import type { TenantStatus } from "@qticaret/types/control-plane"
import type { StatusMove } from "./mutations"

/**
 * Which move a status offers (adr/0061 §2, Ek C15), as the control plane
 * allows them: a suspension from active or restricted, its end from
 * suspended. A shop being set up or closed offers none.
 */
export function moveOf(status: TenantStatus): StatusMove | null {
  if (status === "active" || status === "restricted") {
    return "suspend"
  }
  return status === "suspended" ? "resume" : null
}
