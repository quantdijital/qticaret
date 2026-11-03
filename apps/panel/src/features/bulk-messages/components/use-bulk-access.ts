import { useQuery } from "@tanstack/react-query"
import { staffQuery } from "@/features/auth/api/staff"
import { BULK_MESSAGES_FLAG } from "@/features/bulk-messages/api/types"
import { featuresQuery } from "@/features/settings/api/features"

export type BulkAccess = "loading" | "off" | "denied" | "ok"

/**
 * Whether the screen opens (adr/0050 §7): the shop has bulk messages on
 * and the person may write them (owner and admin, `bulkMessages`).
 */
export function useBulkAccess(): { access: BulkAccess; canTurnOn: boolean } {
  const features = useQuery(featuresQuery())
  const staff = useQuery(staffQuery())
  const canTurnOn = staff.data?.can.settings ?? false
  if (features.isPending || staff.isPending) {
    return { access: "loading", canTurnOn }
  }
  if (!features.data?.some((flag) => flag.key === BULK_MESSAGES_FLAG && flag.enabled)) {
    return { access: "off", canTurnOn }
  }
  return { access: staff.data?.can.bulkMessages ? "ok" : "denied", canTurnOn }
}

export type BulkGateState = ReturnType<typeof useBulkAccess>
