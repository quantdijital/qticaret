import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { orderBookingsQuery } from "@/features/orders/api/bookings"
import type { OrderDeparture } from "@/features/orders/api/bookings"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { formatSlotStart } from "@/features/products/booking/slot-dates"
import { useFeature } from "@/features/settings/api/features"
import { BookingCancelDialog } from "./booking-cancel-dialog"

const K = "orders.bookings"

/**
 * A dated order's departures (adr/0076 Ek D7a), each with its state and,
 * for the roles that may give money back, its cancel. Not drawn for an
 * order without bookings or while dated products are off.
 */
export function BookingCancelCard({ orderId }: { orderId: string }) {
  const flagOn = useFeature(BOOKING_FLAG)
  return flagOn ? <Departures orderId={orderId} /> : null
}

function Departures({ orderId }: { orderId: string }) {
  const { t, i18n } = useTranslation()
  const mayCancel = useCan("money")
  const list = useQuery(orderBookingsQuery(orderId, "tier"))
  const [cancelling, setCancelling] = useState<OrderDeparture | null>(null)
  const departures = list.data?.departures ?? []
  if (departures.length === 0) {
    return null
  }
  return (
    <SectionCard title={t(`${K}.title`)} flush>
      <ul className="flex flex-col">
        {departures.map((departure) => (
          <li
            key={departure.slot_id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">
                {formatSlotStart(departure.starts_at, departure.timezone, i18n.language)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {departure.titles.join(", ")}
              </span>
            </span>
            {departure.cancelled ? (
              <StatusBadge tone="neutral">{t(`${K}.cancelled`)}</StatusBadge>
            ) : mayCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive-text"
                onClick={() => {
                  setCancelling(departure)
                }}
              >
                {t(`${K}.cancel`)}
              </Button>
            ) : (
              <StatusBadge tone="success">{t(`${K}.confirmed`)}</StatusBadge>
            )}
          </li>
        ))}
      </ul>
      {cancelling ? (
        <BookingCancelDialog
          orderId={orderId}
          departure={cancelling}
          onClose={() => {
            setCancelling(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
