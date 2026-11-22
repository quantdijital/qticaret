import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { orderBookingsQuery, useCancelOrderBooking } from "@/features/orders/api/bookings"
import type { BookingCancelMode, OrderDeparture } from "@/features/orders/api/bookings"
import { formatSlotStart } from "@/features/products/booking/slot-dates"
import { errorText } from "@/lib/errors"

const K = "orders.bookings"

/**
 * Cancels one departure of the order (adr/0076 Ek D7a): by the product's
 * tier or with all of it back, the refund read from the server for the
 * chosen way before it is confirmed. Only the departure and the way are
 * sent; the server works the money out again.
 */
export function BookingCancelDialog({
  orderId,
  departure,
  onClose,
}: {
  orderId: string
  departure: OrderDeparture
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const hasTier = departure.fee_percent !== null
  const [mode, setMode] = useState<BookingCancelMode>(hasTier ? "tier" : "full")
  const preview = useQuery(orderBookingsQuery(orderId, mode))
  const cancel = useCancelOrderBooking(orderId)
  const current = preview.data?.departures.find((each) => each.slot_id === departure.slot_id)
  const currency = preview.data?.currency_code ?? "try"
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${K}.cancelTitle`)}
      description={t(`${K}.cancelDescription`, {
        start: formatSlotStart(departure.starts_at, departure.timezone, i18n.language),
      })}
      confirmLabel={t(`${K}.confirm`)}
      destructive
      onConfirm={() => {
        cancel.mutate(
          { slot_id: departure.slot_id, mode },
          {
            onSuccess: () => {
              toast.success(t(`${K}.done`))
            },
            onError: (failure) => {
              toast.error(errorText(t, failure))
            },
          }
        )
        onClose()
      }}
    >
      <RadioGroup
        aria-label={t(`${K}.mode`)}
        value={mode}
        onValueChange={(value) => {
          setMode(value as BookingCancelMode)
        }}
        className="gap-2"
      >
        {(["tier", "full"] as const).map((each) => (
          <label
            key={each}
            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60 has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={each} disabled={each === "tier" && !hasTier} />
            {each === "tier"
              ? hasTier
                ? t(`${K}.modes.tier`, { percent: departure.fee_percent })
                : t(`${K}.modes.noTier`)
              : t(`${K}.modes.full`)}
          </label>
        ))}
      </RadioGroup>
      <p role="status" className="text-sm">
        {preview.isPending
          ? t(`${K}.loading`)
          : current?.refusal
            ? t(`${K}.refusal`)
            : current
              ? t(`${K}.refund`, {
                  amount: formatMoney(current.refund, currency),
                  paid: formatMoney(current.paid, currency),
                })
              : t(`${K}.previewFailed`)}
      </p>
    </ConfirmDialog>
  )
}
