import { useMutation } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A departure on a checked voucher: places counted, no traveler named (adr/0076 Ek D7b). */
export interface VoucherDeparture {
  title: string
  /** Written out in the product's zone by the server. */
  when: string
  starts_at: string
  meeting_point: string | null
  units: number
  cancelled: boolean
}

/** What a typed code is: a booking that stands or was cancelled, or none. */
export type VoucherCheck =
  | { status: "unknown" }
  | {
      status: "valid" | "cancelled"
      booking_id: string
      order_id: string
      order_number: string
      departures: VoucherDeparture[]
    }

/** `POST /admin/booking-vouchers/check`: the code in the body, never in a URL. */
export const useVoucherCheck = () =>
  useMutation({
    mutationFn: (code: string) =>
      sdk.client.fetch<VoucherCheck>("/admin/booking-vouchers/check", {
        method: "POST",
        body: { code },
      }),
  })
