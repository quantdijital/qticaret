import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { BoardOrder, ShipmentStatus } from "@/features/orders/api/orders"

const TONES: Record<ShipmentStatus, StatusTone> = {
  created: "info",
  picked_up: "info",
  in_transit: "info",
  out_for_delivery: "info",
  delivered: "success",
  returned: "warning",
  failed: "danger",
  canceled: "neutral",
}

/** Where the order's carrier parcel stands (adr/0031), its tracking number on hover. */
export function ShippingBadge({ shipping }: { shipping: BoardOrder["shipping"] }) {
  const { t } = useTranslation()
  if (!shipping) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span title={shipping.tracking_number ?? undefined}>
      <StatusBadge tone={TONES[shipping.status]}>
        {t(`orders.shipping.${shipping.status}`)}
      </StatusBadge>
    </span>
  )
}
