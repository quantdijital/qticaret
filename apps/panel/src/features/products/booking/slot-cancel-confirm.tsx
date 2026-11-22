import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { departureCancelQuery } from "@/features/products/api/booking"
import type { BookingSlot } from "@/features/products/api/booking"
import { formatSlotStart } from "./slot-dates"

const B = "products.booking.cancel"

/**
 * Asks before a departure is cancelled, saying what it touches: its
 * bookings, orders and places, and what goes back in all (the server's
 * sum, every booking in full; adr/0076 Ek D7a). Confirmed, sales stop at
 * once and the refunds run on the server; nothing is sent from here but
 * the departure.
 */
export function SlotCancelConfirm({
  slot,
  zone,
  onCancel,
  onConfirm,
}: {
  slot: BookingSlot
  zone: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t, i18n } = useTranslation()
  const preview = useQuery(departureCancelQuery(slot.id))
  const data = preview.data
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      title={t(`${B}.title`)}
      description={t(`${B}.description`, {
        start: formatSlotStart(slot.starts_at, zone, i18n.language),
      })}
      confirmLabel={t(`${B}.confirm`)}
      destructive
      onConfirm={onConfirm}
    >
      {preview.isPending ? (
        <p className="text-sm text-muted-foreground">{t(`${B}.loading`)}</p>
      ) : preview.isError ? (
        <p role="alert" className="text-sm text-destructive-text">
          {t(`${B}.previewFailed`)}
        </p>
      ) : data && data.bookings > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm"
        >
          <p>
            {t(`${B}.touches`, {
              bookings: data.bookings,
              orders: data.orders,
              units: data.units,
            })}
          </p>
          <p className="font-medium">
            {t(data.partial ? `${B}.refundAtLeast` : `${B}.refund`, {
              amount: formatMoney(data.refund, "try"),
            })}
          </p>
          {data.by_hand_orders > 0 ? (
            <p className="font-medium">
              {t(`${B}.byHand`, {
                amount: formatMoney(data.refund_by_hand, "try"),
                count: data.by_hand_orders,
              })}
            </p>
          ) : null}
          <p className="text-muted-foreground">{t(`${B}.after`)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${B}.noBookings`)}</p>
      )}
    </ConfirmDialog>
  )
}
