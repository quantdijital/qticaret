import { useQuery } from "@tanstack/react-query"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { useFeature } from "@/features/settings/api/features"
import { sectionQuery } from "@/features/settings/api/sections"
import type { BookingFlowSettings } from "@/features/settings/api/sections"

/**
 * Whether the voucher check is offered (adr/0076 Ek D7b): while the shop
 * sells dated products and has vouchers; hidden only once the shop is
 * known to run without them.
 */
export function useVouchersOn(): boolean {
  const on = useFeature(BOOKING_FLAG)
  const flow = useQuery({ ...sectionQuery<BookingFlowSettings>("booking"), enabled: on })
  return on && (flow.data?.values.voucher_enabled ?? true)
}
