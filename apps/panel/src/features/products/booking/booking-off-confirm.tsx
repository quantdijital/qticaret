import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { BOOKING_FLAG, slotsQuery } from "@/features/products/api/booking"
import { useFeature } from "@/features/settings/api/features"
import { takenAhead } from "./slot-facts"

const B = "products.booking.off"

/**
 * Asks before a dated product stops being one (adr/0076 Ek D2): its
 * variants' stock tracking does not come back on by itself, so it can sell
 * without limit; places already sold or held ahead are counted.
 */
export function BookingOffConfirm({
  productId,
  onCancel,
  onConfirm,
}: {
  productId: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const flagOn = useFeature(BOOKING_FLAG)
  const slots = useQuery({ ...slotsQuery(productId), enabled: flagOn })
  const taken = slots.data ? takenAhead(slots.data) : 0
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      confirmLabel={t(`${B}.confirm`)}
      destructive
      onConfirm={onConfirm}
    >
      <div className="flex flex-col gap-2 text-sm">
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2">
          {t(`${B}.stock`)}
        </p>
        {taken > 0 ? <p className="font-medium">{t(`${B}.taken`, { count: taken })}</p> : null}
      </div>
    </ConfirmDialog>
  )
}
