import { useQuery } from "@tanstack/react-query"
import { useCan } from "@/features/auth/api/staff"
import { returnableQuery } from "@/features/orders/api/returns"
import type { Returnable } from "@/features/orders/api/returns"

/**
 * Whether staff can open a return or exchange for the shopper who called
 * (F12.3), by the shopper's own rules: within the window, none open, a
 * unit left to send back. The order's menu and its "İade yok" row ask it.
 */
export function useReturnOpenable(orderId: string): {
  openable: boolean
  returnable: Returnable | undefined
} {
  const returnable = useQuery(returnableQuery(orderId))
  const mayReturn = useCan("orders")
  const data = returnable.data
  const openable =
    mayReturn &&
    data !== undefined &&
    data.window_open &&
    !data.open_request &&
    data.lines.some((line) => line.returnable > 0)
  return { openable, returnable: data }
}
