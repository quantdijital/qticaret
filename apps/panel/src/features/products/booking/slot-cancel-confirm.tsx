import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import type { BookingSlot } from "@/features/products/api/booking"
import { formatSlotStart } from "./slot-dates"

const B = "products.booking.cancel"

/**
 * Asks before a departure is cancelled. Its confirmed bookings stay: the
 * refund and the message to the buyers come with D7, until then by hand
 * (adr/0076 Ek D2, review note for D4); their count is said plainly.
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
      {slot.sold > 0 ? (
        <p
          role="alert"
          className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm"
        >
          {t(`${B}.sold`, { count: slot.sold })}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
